import { useState, useEffect } from 'react';
import { Student, Attendance, LeaveRequest, Room, Hostel, MonthlyBill, Notification, Notice, MealRates } from '../types';
import { INITIAL_MEAL_RATES } from '../lib/dataStore';
import { 
  db, 
  collection, 
  doc, 
  getDoc,
  setDoc,
  onSnapshot,
  query,
  where,
  limit
} from '../lib/firebase';
import { initializeDatabase } from '../services/initializationService';
import { 
  createStudent, 
  updateStudent, 
  deleteStudent as svcDeleteStudent, 
  importStudentsFromCSV as svcImportCSV 
} from '../services/studentService';
import { recordAttendanceScan, deleteAttendanceRecord } from '../services/attendanceService';
import { recalculateBillForStudentInMonth } from '../services/billingService';
import { publishNotice as svcPublishNotice } from '../services/noticeService';

export function useHostelSystem(
  user: any, 
  role: 'admin' | 'student' | 'super_admin' | 'superintendent' | 'staff' | null, 
  studentData: Student | null, 
  adminData?: any,
  overrideHostelId?: string,
  overrideHostelName?: string
) {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [mealRates, setMealRates] = useState<MealRates>(INITIAL_MEAL_RATES);
  const [monthlyBills, setMonthlyBills] = useState<MonthlyBill[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dbSynced, setDbSynced] = useState<boolean>(false);

  // Target hostel metadata for filtering
  const targetHostelId = overrideHostelId || adminData?.hostelId || studentData?.hostelId || '';
  const targetHostelName = overrideHostelName || adminData?.hostelName || studentData?.hostelName || '';

  // 1. Database Initialization and Real-time Observers
  useEffect(() => {
    if (!user || !role) {
      setStudents([]);
      setAttendance([]);
      setLeaveRequests([]);
      setRooms([]);
      setHostels([]);
      setMealRates(INITIAL_MEAL_RATES);
      setMonthlyBills([]);
      setNotifications([]);
      setDbSynced(false);
      setLoading(false);
      return;
    }

    let unsubscribes: (() => void)[] = [];

    async function initAndSubscribe() {
      try {
        setLoading(true);

        if (role === 'admin' || role === 'superintendent') {
          // Idempotently initialize standard database schemas, config docs, & room layouts
          await initializeDatabase();
        }

        // ----------------- SETUP TARGETED SNAPSHOT LISTENERS -----------------
        const studentDocId = studentData?.id || user.uid;
        
        // A. Students Collection / Document Listener (Strictly targeted)
        let unsubStudents;
        if (role === 'student') {
          const targetId = studentData?.id || studentDocId;
          if (targetId) {
            unsubStudents = onSnapshot(doc(db, 'students', targetId), (snapshot) => {
              if (snapshot.exists()) {
                const data = snapshot.data() as Student;
                setStudents([{
                  ...data,
                  id: snapshot.id || data.id || data.uid,
                  hostelId: data.hostelId || targetHostelId,
                  hostelName: data.hostelName || targetHostelName
                }]);
              } else if (studentData) {
                setStudents([studentData]);
              } else {
                setStudents([]);
              }
            }, (err) => {
              console.warn('Student profile snapshot listener error:', err);
            });
          }
        } else {
          const isSuperAdminAll = role === 'super_admin' && !overrideHostelId;
          const qStudents = isSuperAdminAll
            ? collection(db, 'students')
            : query(collection(db, 'students'), where('hostelId', '==', targetHostelId));

          unsubStudents = onSnapshot(qStudents, (snapshot) => {
            const list: Student[] = [];
            snapshot.forEach(docSnap => {
              const data = docSnap.data() as Student;
              list.push({
                ...data,
                id: docSnap.id || data.id || data.uid,
                hostelId: data.hostelId || targetHostelId,
                hostelName: data.hostelName || targetHostelName
              });
            });
            setStudents(list);
          }, (err) => {
            console.warn('Students snapshot listener error:', err);
          });
        }
        if (unsubStudents) unsubscribes.push(unsubStudents);

        // B. Attendance Collection (Targeted by student or hostelId)
        let qAttendance;
        if (role === 'student') {
          qAttendance = query(collection(db, 'attendance'), where('studentId', '==', studentDocId));
        } else if (role === 'super_admin' && !overrideHostelId) {
          qAttendance = collection(db, 'attendance');
        } else {
          qAttendance = query(collection(db, 'attendance'), where('hostelId', '==', targetHostelId));
        }

        const unsubAttendance = onSnapshot(qAttendance, (snapshot) => {
          const list: Attendance[] = [];
          snapshot.forEach(docSnap => {
            list.push(docSnap.data() as Attendance);
          });
          list.sort((a, b) => {
            const dateComp = (b.date || '').localeCompare(a.date || '');
            if (dateComp !== 0) return dateComp;
            return (b.time || '').localeCompare(a.time || '');
          });
          setAttendance(list);
        }, (err) => {
          console.warn('Attendance snapshot listener error:', err);
        });
        unsubscribes.push(unsubAttendance);

        // C. Leave Requests Collection (Targeted by student or hostelId)
        let qLeaves;
        if (role === 'student') {
          qLeaves = query(collection(db, 'leaveRequests'), where('studentId', '==', studentDocId));
        } else if (role === 'super_admin' && !overrideHostelId) {
          qLeaves = collection(db, 'leaveRequests');
        } else {
          qLeaves = query(collection(db, 'leaveRequests'), where('hostelId', '==', targetHostelId));
        }

        const unsubLeaves = onSnapshot(qLeaves, (snapshot) => {
          const list: LeaveRequest[] = [];
          snapshot.forEach(docSnap => {
            list.push(docSnap.data() as LeaveRequest);
          });
          list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          setLeaveRequests(list);
        }, (err) => {
          console.warn('Leave Requests snapshot listener error:', err);
        });
        unsubscribes.push(unsubLeaves);

        // D. Rooms Collection (Targeted by hostelId)
        let qRooms;
        if (role === 'super_admin' && !overrideHostelId) {
          qRooms = collection(db, 'rooms');
        } else {
          qRooms = query(collection(db, 'rooms'), where('hostelId', '==', targetHostelId));
        }

        const unsubRooms = onSnapshot(qRooms, (snapshot) => {
          const list: Room[] = [];
          snapshot.forEach(docSnap => {
            list.push(docSnap.data() as Room);
          });
          list.sort((a, b) => (a.roomNumber || '').localeCompare(b.roomNumber || ''));
          setRooms(list);
        }, (err) => {
          console.warn('Rooms snapshot listener error:', err);
        });
        unsubscribes.push(unsubRooms);

        // E. Hostels (Targeted document for regular users, collection only for Super Admin)
        let unsubHostels;
        if (role === 'super_admin' && !overrideHostelId) {
          unsubHostels = onSnapshot(collection(db, 'hostels'), (snapshot) => {
            const list: Hostel[] = [];
            snapshot.forEach(docSnap => {
              list.push({ ...docSnap.data(), id: docSnap.id } as Hostel);
            });
            setHostels(list);
          }, (err) => {
            console.warn('Hostels snapshot listener error:', err);
          });
        } else if (targetHostelId) {
          unsubHostels = onSnapshot(doc(db, 'hostels', targetHostelId), (snapshot) => {
            if (snapshot.exists()) {
              setHostels([{ ...snapshot.data(), id: snapshot.id } as Hostel]);
            } else {
              setHostels([]);
            }
          }, (err) => {
            console.warn('Hostels snapshot listener error:', err);
          });
        } else {
          setHostels([]);
        }
        if (unsubHostels) unsubscribes.push(unsubHostels);

        // F. Meal Rates Current Document
        const unsubRates = onSnapshot(doc(db, 'mealRates', 'current'), (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setMealRates({
              lunchPrice: data.lunchPrice || data.lunch || 35,
              dinnerPrice: data.dinnerPrice || data.dinner || 35
            });
          }
        }, (err) => {
          console.warn('Meal Rates snapshot listener error:', err);
        });
        unsubscribes.push(unsubRates);

        // G. Monthly Bills Collection (Targeted by student or hostelId)
        let qBills;
        if (role === 'student') {
          qBills = query(collection(db, 'monthlyBills'), where('studentId', '==', studentDocId));
        } else if (role === 'super_admin' && !overrideHostelId) {
          qBills = collection(db, 'monthlyBills');
        } else {
          qBills = query(collection(db, 'monthlyBills'), where('hostelId', '==', targetHostelId));
        }

        const unsubBills = onSnapshot(qBills, (snapshot) => {
          const list: MonthlyBill[] = [];
          snapshot.forEach(docSnap => {
            list.push(docSnap.data() as MonthlyBill);
          });
          setMonthlyBills(list);
        }, (err) => {
          console.warn('Monthly Bills snapshot listener error:', err);
        });
        unsubscribes.push(unsubBills);

        // H. Notifications Collection (Capped to recent 25)
        const qNotifs = query(collection(db, 'notifications'), limit(25));
        const unsubNotifs = onSnapshot(qNotifs, (snapshot) => {
          const list: Notification[] = [];
          snapshot.forEach(docSnap => list.push(docSnap.data() as Notification));
          list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          setNotifications(list);
        }, (err) => {
          console.warn('Notifications snapshot listener error:', err);
        });
        unsubscribes.push(unsubNotifs);

        // I. Official Hostel Notices Subcollection (only when targetHostelId is valid)
        if (targetHostelId) {
          const unsubNotices = onSnapshot(collection(db, 'hostels', targetHostelId, 'notices'), (snapshot) => {
            const list: Notice[] = [];
            snapshot.forEach(docSnap => list.push(docSnap.data() as Notice));
            list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            setNotices(list);
          }, (err) => {
            console.warn('Hostel Notices snapshot listener error:', err);
          });
          unsubscribes.push(unsubNotices);
        } else {
          setNotices([]);
        }

        setDbSynced(true);
      } catch (error) {
        console.error('Error starting real-time database subscriptions:', error);
      } finally {
        setLoading(false);
      }
    }

    initAndSubscribe();

    // Clean up real-time observers on component unmount
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user?.uid, role, studentData?.id, targetHostelId, targetHostelName]);

  // ----------------- HOOK ACTION IMPLEMENTATIONS -----------------

  // 1. ADD / EDIT STUDENT
  const upsertStudent = async (student: Student) => {
    const existingById = students.find(s => s.id === student.id);
    const existingByRoll = students.find(s => s.rollNumber.trim().toUpperCase() === student.rollNumber.trim().toUpperCase());
    
    if (existingById || existingByRoll) {
      const targetId = existingById?.id || existingByRoll?.id || student.id;
      await updateStudent({ ...student, id: targetId });
    } else {
      await createStudent(student);
    }
  };

  // 2. DELETE STUDENT
  const deleteStudent = async (studentId: string) => {
    await svcDeleteStudent(studentId);
  };

  // 3. REALLOCATE ROOM
  const reallocateRoom = async (studentId: string, newHostel: string, newRoom: string, newBed: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const updatedStudent: Student = {
      ...student,
      hostelName: newHostel,
      roomNumber: newRoom,
      bedNumber: newBed
    };

    await updateStudent(updatedStudent);
  };

  // 4. RECORD ATTENDANCE (SCAN OR MANUAL)
  const recordAttendance = async (
    studentId: string, 
    type: 'hostel' | 'lunch' | 'dinner', 
    status: 'present' | 'absent' | 'leave', 
    recordedBy: 'scanner' | 'manual' = 'scanner',
    notes?: string,
    targetDate?: string
  ): Promise<Attendance | null> => {
    const suptInfo = {
      uid: adminData?.id || adminData?.uid || user?.uid || 'supt_admin',
      email: user?.email || adminData?.email || '',
      name: adminData?.name || user?.displayName || 'Administrator',
      role: role || 'admin',
      hostelId: targetHostelId
    };
    return await recordAttendanceScan(studentId, type, status, recordedBy, notes, targetDate, suptInfo);
  };

  // 4B. DELETE ATTENDANCE RECORD
  const deleteAttendance = async (attendanceId: string, reason: string = 'Superintendent correction'): Promise<void> => {
    const suptInfo = {
      superintendentId: adminData?.id || adminData?.uid || user?.uid || 'supt_admin',
      superintendentHostelId: targetHostelId,
      superintendentHostelName: targetHostelName
    };
    await deleteAttendanceRecord(attendanceId, suptInfo, reason);
  };

  // 5. SUBMIT LEAVE REQUEST
  const submitLeaveRequest = async (leave: Omit<LeaveRequest, 'id' | 'status' | 'createdAt'>) => {
    const leaveId = `lv_${Date.now()}`;
    const newLeave: LeaveRequest = {
      ...leave,
      id: leaveId,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'leaveRequests', leaveId), newLeave);

    // Set student state to pending leave
    const student = students.find(s => s.id === leave.studentId);
    if (student) {
      await updateStudent({
        ...student,
        leaveStatus: 'pending'
      });
    }

    // Publish notification to all
    await publishNotification({
      title: 'New Leave Applied',
      message: `${leave.studentName} (${leave.rollNumber}) applied for leave from ${leave.startDate} to ${leave.endDate}.`,
      type: 'leave_status',
      target: 'all',
      sender: leave.studentName
    });
  };

  // 6. PROCESS LEAVE REQUEST
  const processLeaveRequest = async (
    leaveId: string, 
    status: 'approved' | 'rejected' | 'pending', 
    inchargeName: string
  ) => {
    const leave = leaveRequests.find(l => l.id === leaveId);
    if (!leave) return;

    const updatedLeave: LeaveRequest = {
      ...leave,
      status,
      processedAt: new Date().toISOString(),
      processedBy: inchargeName
    };

    await setDoc(doc(db, 'leaveRequests', leaveId), updatedLeave);

    const student = students.find(s => s.id === leave.studentId);
    if (student) {
      const updatedStudent: Student = {
        ...student,
        leaveStatus: status === 'pending' ? 'pending' : (status === 'approved' ? 'approved' : 'rejected'),
        hostelStatus: status === 'approved' ? 'leave' : student.hostelStatus
      };
      await updateStudent(updatedStudent);

      // Notify the student
      await publishNotification({
        title: `Leave Application ${status.toUpperCase()}`,
        message: `Your leave request from ${leave.startDate} to ${leave.endDate} has been ${status} by the Hostel In-charge.`,
        type: 'leave_status',
        target: student.id,
        sender: inchargeName
      });
    }
  };

  // 7. MESS RATES UPDATE
  const updateMealRates = async (rates: MealRates) => {
    await setDoc(doc(db, 'mealRates', 'current'), rates);
    await setDoc(doc(db, 'mealRates', 'default'), {
      lunch: rates.lunchPrice,
      dinner: rates.dinnerPrice,
      currency: "INR",
      updatedAt: new Date().toISOString()
    });
    // Recompute current month bills
    const currentMonth = new Date().toISOString().substring(0, 7);
    await recalculateAllBills(currentMonth, rates);
  };

  // 8. RECALCULATE STUDENT BILL
  const recalculateBillForStudent = async (studentId: string, monthStr: string) => {
    const student = students.find(s => s.id === studentId);
    if (student) {
      await recalculateBillForStudentInMonth(studentId, monthStr, student.messStatus);
    }
  };

  // 9. RECALCULATE ALL BILLS
  const recalculateAllBills = async (monthStr: string, rates = mealRates) => {
    for (const s of students) {
      await recalculateBillForStudentInMonth(s.id, monthStr, s.messStatus);
    }
  };

  // 10. MARK BILL PAID / UNPAID
  const markBillPaid = async (billId: string, status: 'paid' | 'unpaid') => {
    const billRef = doc(db, 'monthlyBills', billId);
    const snap = await getDoc(billRef);
    if (snap.exists()) {
      await setDoc(billRef, {
        ...snap.data(),
        status,
        updatedAt: new Date().toISOString()
      });
    }
  };

  // 11. PUBLISH NOTIFICATION
  const publishNotification = async (notif: Omit<Notification, 'id' | 'createdAt'>) => {
    const notifId = `nt_${Date.now()}`;
    const newNotif: Notification = {
      ...notif,
      id: notifId,
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'notifications', notifId), newNotif);
  };

  // 12. CSV EXCEL BULK IMPORT
  const importStudentsFromCSV = async (csvContent: string): Promise<boolean> => {
    return await svcImportCSV(csvContent);
  };

  return {
    students,
    attendance,
    leaveRequests,
    rooms,
    hostels,
    mealRates,
    monthlyBills,
    notifications,
    notices,
    loading,
    dbSynced,
    upsertStudent,
    deleteStudent,
    reallocateRoom,
    recordAttendance,
    deleteAttendance,
    submitLeaveRequest,
    processLeaveRequest,
    updateMealRates,
    recalculateBillForStudent,
    recalculateAllBills,
    markBillPaid,
    publishNotification,
    importStudentsFromCSV
  };
}
