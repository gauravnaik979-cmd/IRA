import { 
  db, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  collection, 
  query, 
  where, 
  retryOperation 
} from './firestoreService';
import { Student, MonthlyBill, Attendance, MealRates } from '../types';

/**
 * Ensures a monthly bill document exists for a student in a specific month.
 */
export async function createMonthlyBillIfMissing(
  student: Student,
  monthStr: string // YYYY-MM
): Promise<MonthlyBill> {
  const [year, month] = monthStr.split('-');
  const billId = `${student.id}_${year}_${month}`;
  const billRef = doc(db, 'monthlyBills', billId);
  const snap = await retryOperation(() => getDoc(billRef));

  if (snap.exists()) {
    return snap.data() as MonthlyBill;
  }

  const newBill = {
    id: billId,
    studentId: student.id,
    studentName: student.name,
    rollNumber: student.rollNumber,
    department: student.department,
    roomNumber: student.roomNumber,
    month: monthStr,
    year: year,
    lunchCount: 0,
    dinnerCount: 0,
    totalMeals: 0,
    leaveDays: 0,
    totalAmount: 0,
    status: 'unpaid',
    updatedAt: new Date().toISOString()
  };

  await retryOperation(() => setDoc(billRef, newBill));
  return newBill as unknown as MonthlyBill;
}

/**
 * Calculates / recalculates a student's bill for a specific month based on actual attendance scans and approved leaves.
 */
export async function recalculateBillForStudentInMonth(
  studentId: string,
  monthStr: string,
  messStatus: 'active' | 'inactive'
): Promise<void> {
  const [year, month] = monthStr.split('-');
  const billId = `${studentId}_${year}_${month}`;
  
  // 1. Fetch Student Document
  const studentSnap = await retryOperation(() => getDoc(doc(db, 'students', studentId)));
  if (!studentSnap.exists()) return;
  const student = studentSnap.data() as Student;

  // 2. Fetch current Meal Rates
  const ratesSnap = await retryOperation(() => getDoc(doc(db, 'mealRates', 'current')));
  let lunchPrice = 35;
  let dinnerPrice = 35;
  if (ratesSnap.exists()) {
    const ratesData = ratesSnap.data();
    lunchPrice = ratesData.lunchPrice || ratesData.lunch || 35;
    dinnerPrice = ratesData.dinnerPrice || ratesData.dinner || 35;
  }
  
  // 3. Fetch Student Attendance records for this month
  const attRef = collection(db, 'attendance');
  const attQuery = query(
    attRef, 
    where('studentId', '==', studentId)
  );
  const attSnap = await retryOperation(() => getDocs(attQuery));
  
  const attendanceList: Attendance[] = [];
  attSnap.forEach(docSnap => {
    const data = docSnap.data() as Attendance;
    if (data.date && data.date.startsWith(monthStr)) {
      attendanceList.push(data);
    }
  });

  const isActive = messStatus === 'active';
  const monthAtt = attendanceList.filter(a => a.status === 'present');

  const lunchCount = isActive ? monthAtt.filter(a => a.type === 'lunch').length : 0;
  const dinnerCount = isActive ? monthAtt.filter(a => a.type === 'dinner').length : 0;

  // 4. Fetch Approved Leaves
  const leavesRef = collection(db, 'leaveRequests');
  const leavesQuery = query(
    leavesRef, 
    where('studentId', '==', studentId), 
    where('status', '==', 'approved')
  );
  const leavesSnap = await retryOperation(() => getDocs(leavesQuery));
  
  let leaveDays = 0;
  leavesSnap.forEach(docSnap => {
    const l = docSnap.data();
    if (l.startDate && l.endDate && (l.startDate.startsWith(monthStr) || l.endDate.startsWith(monthStr))) {
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      leaveDays += diffDays;
    }
  });

  const totalAmount = (lunchCount * lunchPrice) + (dinnerCount * dinnerPrice);

  const billRef = doc(db, 'monthlyBills', billId);
  const billSnap = await retryOperation(() => getDoc(billRef));
  const existingStatus = billSnap.exists() ? (billSnap.data().status || 'unpaid') : 'unpaid';

  const updatedBill = {
    id: billId,
    studentId,
    studentName: student.name,
    rollNumber: student.rollNumber,
    department: student.department,
    roomNumber: student.roomNumber,
    month: monthStr,
    year: year,
    lunchCount,
    dinnerCount,
    totalMeals: lunchCount + dinnerCount,
    leaveDays,
    totalAmount,
    status: existingStatus,
    updatedAt: new Date().toISOString()
  };

  await retryOperation(() => setDoc(billRef, updatedBill));
}
