import { 
  db, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc,
  collection, 
  query, 
  where, 
  retryOperation,
  runTransaction
} from './firestoreService';
import { Student, Attendance, MonthlyBill } from '../types';
import { recalculateBillForStudentInMonth } from './billingService';
import { updateHostelCounters } from './studentService';

export interface ScanTransactionLog {
  id: string;
  studentId: string;
  studentName?: string;
  rollNumber?: string;
  hostelId: string;
  mealType: 'hostel' | 'lunch' | 'dinner';
  timestamp: string;
  ledgerUpdated: boolean;
  status: 'success' | 'failed' | 'sync_error';
  attendanceId: string;
  billId?: string;
  lunchCount?: number;
  dinnerCount?: number;
  totalAmount?: number;
  error?: string;
}

/**
 * Processes a scanned QR code or manual attendance marking.
 * Uses an atomic Firestore transaction to write attendance, update the Monthly Mess Ledger,
 * and create a transaction log in a single committed unit.
 * Includes post-write verification checks to ensure data consistency.
 */
export async function recordAttendanceScan(
  studentIdentifier: string, // Student ID, Roll Number, or QR ID
  type: 'hostel' | 'lunch' | 'dinner',
  status: 'present' | 'absent' | 'leave' = 'present',
  recordedBy: 'scanner' | 'manual' = 'scanner',
  notes?: string,
  targetDate?: string,
  superintendentInfo?: {
    uid?: string;
    email?: string;
    name?: string;
    role?: string;
    hostelId?: string;
  }
): Promise<Attendance> {
  if (!type || (type !== 'lunch' && type !== 'dinner' && type !== 'hostel')) {
    throw new Error(`Invalid mealType/type specified: "${type}"`);
  }

  let student: Student | null = null;

  // 1. Initial Student Lookup
  const studentDocRef = doc(db, 'students', studentIdentifier);
  const studentSnap = await retryOperation(() => getDoc(studentDocRef));
  
  if (studentSnap.exists()) {
    student = studentSnap.data() as Student;
  } else {
    // Look up by QR ID field
    const qrQuery = query(collection(db, 'students'), where('qrId', '==', studentIdentifier));
    const qrSnap = await retryOperation(() => getDocs(qrQuery));
    if (!qrSnap.empty) {
      student = qrSnap.docs[0].data() as Student;
    } else {
      // Look up by Roll Number field
      const rollQuery = query(collection(db, 'students'), where('rollNumber', '==', studentIdentifier));
      const rollSnap = await retryOperation(() => getDocs(rollQuery));
      if (!rollSnap.empty) {
        student = rollSnap.docs[0].data() as Student;
      }
    }
  }

  if (!student) {
    throw new Error(`Student not found with ID, Roll, or QR: "${studentIdentifier}"`);
  }

  const targetStudentId = student.id;

  // Outer wrapper with automatic retries if transaction or verification fails
  return await retryOperation(async () => {
    const now = new Date();
    // Normalize date to YYYY-MM-DD
    const effectiveDateStr = targetDate && targetDate.match(/^\d{4}-\d{2}-\d{2}$/)
      ? targetDate
      : now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];
    const monthStr = effectiveDateStr.substring(0, 7); // YYYY-MM
    const [year, month] = monthStr.split('-');

    const attId = `att_${targetStudentId}_${effectiveDateStr}_${type}`;
    const billId = `${targetStudentId}_${year}_${month}`;
    const txLogId = `tx_${now.getTime()}_${targetStudentId}_${Math.random().toString(36).substring(2, 6)}`;

    const hostelId = (student as any).hostelId || student.hostelName || superintendentInfo?.hostelId || 'gangpur-boys-hostel';

    const attRef = doc(db, 'attendance', attId);
    const billRef = doc(db, 'monthlyBills', billId);
    const ratesRef = doc(db, 'mealRates', 'current');
    const txLogRef = doc(db, 'transactionLogs', txLogId);

    let createdAttendance: Attendance | null = null;
    let expectedLunch = 0;
    let expectedDinner = 0;
    let prevStatus = 'none';

    // 2. ATOMIC FIRESTORE TRANSACTION
    await runTransaction(db, async (transaction) => {
      // Read 0: Meal Session Status Verification (only enforced for live scanner, manual overrides are allowed)
      const sessionRef = doc(db, 'mealSessions', 'current');
      const sessionSnap = await transaction.get(sessionRef);

      if ((type === 'lunch' || type === 'dinner') && recordedBy !== 'manual') {
        if (!sessionSnap.exists()) {
          throw new Error("🔴 Meal Session Closed. Attendance is currently locked. Please contact the Hostel Superintendent.");
        }
        const sessionData = sessionSnap.data();
        const isMealMatching = sessionData.currentMeal && sessionData.currentMeal.toLowerCase() === type.toLowerCase();
        if (sessionData.status !== 'OPEN' || !isMealMatching) {
          throw new Error("🔴 Meal Session Closed. Attendance is currently locked. Please contact the Hostel Superintendent.");
        }
      }

      // Read 1: Student document inside transaction
      const sRef = doc(db, 'students', targetStudentId);
      const sSnap = await transaction.get(sRef);
      const activeStudent = sSnap.exists() ? (sSnap.data() as Student) : student!;

      // Read 2: Existing Attendance document
      const attSnap = await transaction.get(attRef);
      const isAlreadyPresent = attSnap.exists() && attSnap.data().status === 'present';
      prevStatus = attSnap.exists() ? (attSnap.data().status || 'none') : 'none';

      // Read 3: Meal Rates
      const ratesSnap = await transaction.get(ratesRef);
      let lunchPrice = 35;
      let dinnerPrice = 35;
      if (ratesSnap.exists()) {
        const ratesData = ratesSnap.data();
        lunchPrice = ratesData.lunchPrice || ratesData.lunch || 35;
        dinnerPrice = ratesData.dinnerPrice || ratesData.dinner || 35;
      }

      // Read 4: Monthly Bill Ledger
      const billSnap = await transaction.get(billRef);
      let currentLunch = 0;
      let currentDinner = 0;
      let leaveDays = 0;
      let billStatus: 'paid' | 'unpaid' = 'unpaid';

      if (billSnap.exists()) {
        const bData = billSnap.data();
        currentLunch = bData.lunchCount || 0;
        currentDinner = bData.dinnerCount || 0;
        leaveDays = bData.leaveDays || 0;
        billStatus = (bData.status === 'paid' ? 'paid' : 'unpaid');
      }

      // Calculate new meal counts accurately & idempotently
      const isActiveMess = activeStudent.messStatus !== 'inactive';
      const shouldIncrement = isActiveMess && status === 'present' && !isAlreadyPresent;
      const shouldDecrement = isActiveMess && isAlreadyPresent && status !== 'present';

      let newLunch = currentLunch;
      let newDinner = currentDinner;

      if (type === 'lunch') {
        newLunch = Math.max(0, currentLunch + (shouldIncrement ? 1 : 0) - (shouldDecrement ? 1 : 0));
      } else if (type === 'dinner') {
        newDinner = Math.max(0, currentDinner + (shouldIncrement ? 1 : 0) - (shouldDecrement ? 1 : 0));
      }

      expectedLunch = newLunch;
      expectedDinner = newDinner;

      const totalMeals = newLunch + newDinner;
      const totalAmount = (newLunch * lunchPrice) + (newDinner * dinnerPrice);

      const targetEffectiveHostelId = (activeStudent as any).hostelId || activeStudent.hostelName || hostelId;

      // Attendance Document
      createdAttendance = {
        id: attId,
        studentId: activeStudent.id,
        studentName: activeStudent.name,
        rollNumber: activeStudent.rollNumber,
        hostelId: targetEffectiveHostelId,
        hostelName: activeStudent.hostelName || 'Gangpur Boys\' Hostel',
        roomNumber: activeStudent.roomNumber || '',
        date: effectiveDateStr,
        time: timeStr,
        type: type, // Canonical discriminator: 'lunch' | 'dinner' | 'hostel'
        status: status,
        recordedBy: recordedBy,
        notes: notes || '',
        ...(recordedBy === 'manual' ? {
          correctedBy: superintendentInfo?.name || superintendentInfo?.email || superintendentInfo?.uid || 'Administrator',
          correctionReason: notes || 'Manual register correction',
          updatedAt: new Date().toISOString()
        } : {})
      };

      // Updated Monthly Mess Ledger Document
      const updatedBill: MonthlyBill = {
        id: billId,
        studentId: activeStudent.id,
        studentName: activeStudent.name,
        rollNumber: activeStudent.rollNumber,
        department: activeStudent.department || 'General',
        roomNumber: activeStudent.roomNumber || '',
        hostelId: targetEffectiveHostelId,
        hostelName: activeStudent.hostelName || '',
        month: monthStr,
        year: year,
        lunchCount: newLunch,
        dinnerCount: newDinner,
        totalMeals: totalMeals,
        leaveDays: leaveDays,
        totalAmount: totalAmount,
        status: billStatus,
        updatedAt: new Date().toISOString()
      };

      // Transaction Log Document for Live Scans
      const txLog: ScanTransactionLog = {
        id: txLogId,
        studentId: activeStudent.id,
        studentName: activeStudent.name,
        rollNumber: activeStudent.rollNumber,
        hostelId: targetEffectiveHostelId,
        mealType: type,
        timestamp: new Date().toISOString(),
        ledgerUpdated: true,
        status: 'success',
        attendanceId: attId,
        billId: billId,
        lunchCount: newLunch,
        dinnerCount: newDinner,
        totalAmount: totalAmount
      };

      // ATOMIC WRITES (Commit attendance + ledger + txLog together)
      transaction.set(attRef, createdAttendance);
      if (type === 'lunch' || type === 'dinner') {
        transaction.set(billRef, updatedBill);
      }
      if (recordedBy === 'scanner') {
        transaction.set(txLogRef, txLog);
      }

      if (type === 'hostel') {
        transaction.update(sRef, { hostelStatus: status });
      }
    });

    // 3. POST-WRITE VERIFICATION CHECK
    const verAttSnap = await getDoc(attRef);
    const attExists = verAttSnap.exists();

    if (!attExists) {
      console.error('[Data Sync Failed] Attendance document missing after transaction commit!');
      throw new Error('Data Sync Failed: Attendance document missing.');
    }

    if (type === 'lunch' || type === 'dinner') {
      const verBillSnap = await getDoc(billRef);
      if (!verBillSnap.exists()) {
        console.warn('[Ledger Notice] Monthly bill ledger missing after transaction.');
      }
    }

    // 4. Audit Log for Administrative / Manual Corrections
    if (recordedBy === 'manual') {
      const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const auditDoc = {
        id: auditId,
        superintendentId: superintendentInfo?.uid || 'supt_admin',
        hostelId: (student as any).hostelId || student.hostelName || hostelId,
        studentId: student.id,
        studentName: student.name,
        rollNumber: student.rollNumber,
        attendanceId: attId,
        registerType: type,
        previousStatus: prevStatus,
        newStatus: status,
        reason: notes || 'Manual Register Correction',
        timestamp: new Date().toISOString(),
        source: 'manual_correction',
        correctedBy: superintendentInfo?.uid || 'admin',
        correctedByName: superintendentInfo?.name || 'Administrator',
        correctedByEmail: superintendentInfo?.email || ''
      };
      await retryOperation(() => setDoc(doc(db, 'audit_logs', auditId), auditDoc)).catch(err => {
        console.warn('audit_logs write non-blocking notice:', err);
      });
    }

    // 5. Refresh global dashboard stats
    await updateHostelCounters().catch(err => console.warn('updateHostelCounters note:', err));

    return createdAttendance!;
  }, 3, 600);
}

/**
 * Deletes an attendance document from Firestore.
 * Verifies hostel authorization, logs to `audit_logs`, recalculates monthly bill and meal count,
 * and updates global dashboard stats.
 */
export async function deleteAttendanceRecord(
  attendanceId: string,
  superintendentInfo: {
    superintendentId: string;
    superintendentHostelId: string;
    superintendentHostelName: string;
  },
  reason: string = 'Superintendent correction'
): Promise<void> {
  if (!attendanceId) {
    throw new Error('Attendance ID is required for deletion.');
  }

  // 1. Fetch attendance document to ensure it exists
  const attRef = doc(db, 'attendance', attendanceId);
  const attSnap = await retryOperation(() => getDoc(attRef));

  if (!attSnap.exists()) {
    throw new Error('Attendance record not found or has already been deleted.');
  }

  const attData = attSnap.data() as Attendance;

  // 2. Fetch Student details to verify hostel authorization (Requirement 8)
  const studentRef = doc(db, 'students', attData.studentId);
  const studentSnap = await retryOperation(() => getDoc(studentRef));

  if (studentSnap.exists()) {
    const studentData = studentSnap.data() as Student;
    
    // Check if superintendent's hostel matches student's hostel
    const studentHostelId = (studentData as any).hostelId || studentData.hostelName;
    const suptHostelId = superintendentInfo.superintendentHostelId || superintendentInfo.superintendentHostelName;

    if (
      suptHostelId &&
      studentHostelId &&
      studentData.hostelName !== superintendentInfo.superintendentHostelName &&
      (studentData as any).hostelId !== superintendentInfo.superintendentHostelId
    ) {
      throw new Error(
        `Unauthorized: Only the logged-in superintendent of ${studentData.hostelName} can delete attendance for students in their own hostel.`
      );
    }
  }

  // 3. Delete attendance document from Firestore (Requirement 4)
  await retryOperation(() => deleteDoc(attRef));

  // 4. Record audit log in `audit_logs` collection (Requirement 7)
  const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const auditDoc = {
    id: auditId,
    superintendentId: superintendentInfo.superintendentId || 'supt_unknown',
    hostelId: superintendentInfo.superintendentHostelId || superintendentInfo.superintendentHostelName || 'gangpur-boys-hostel',
    studentId: attData.studentId,
    attendanceId: attendanceId,
    reason: reason || 'Superintendent correction',
    timestamp: new Date().toISOString()
  };

  await retryOperation(() => setDoc(doc(db, 'audit_logs', auditId), auditDoc));

  // 5. Automatically recalculate monthly bill & meal count (Requirement 4)
  const monthStr = attData.date ? attData.date.substring(0, 7) : new Date().toISOString().substring(0, 7);
  if (studentSnap.exists()) {
    const studentData = studentSnap.data() as Student;
    await recalculateBillForStudentInMonth(attData.studentId, monthStr, studentData.messStatus);
  } else {
    await recalculateBillForStudentInMonth(attData.studentId, monthStr, 'active');
  }

  // 6. Refresh all dashboards immediately via updated hostel counters
  await updateHostelCounters();
}

