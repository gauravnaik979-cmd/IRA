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
  createBatch, 
  retryOperation 
} from './firestoreService';
import { Student } from '../types';
import { updateRoomOccupancy } from './roomService';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { ref, uploadBytes, uploadString, getDownloadURL } from 'firebase/storage';
import { firebaseConfig, storage } from '../lib/firebase';

/**
 * Uploads student photo to Firebase Storage under student-photos/{hostelId}/{studentId}.jpg
 */
export async function uploadStudentPhoto(
  hostelId: string,
  studentId: string,
  photoInput: File | string
): Promise<string> {
  const sanitizeHostel = (hostelId || 'general').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const sanitizeStudent = (studentId || 'new_student').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const path = `student-photos/${sanitizeHostel}/${sanitizeStudent}.jpg`;
  const photoRef = ref(storage, path);

  try {
    if (typeof photoInput === 'string') {
      if (photoInput.startsWith('data:')) {
        await uploadString(photoRef, photoInput, 'data_url');
      } else if (photoInput.startsWith('http')) {
        return photoInput;
      } else {
        await uploadString(photoRef, photoInput, 'raw');
      }
    } else {
      await uploadBytes(photoRef, photoInput, { contentType: photoInput.type || 'image/jpeg' });
    }
    const downloadUrl = await getDownloadURL(photoRef);
    return downloadUrl;
  } catch (err) {
    console.warn(`[Firebase Storage] Upload notice for path ${path}:`, err);
    if (typeof photoInput === 'string') return photoInput;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string || '');
      reader.readAsDataURL(photoInput);
    });
  }
}

/**
 * Re-calculates and updates the unified global statistics of the hostel.
 */
export async function updateHostelCounters(): Promise<void> {
  try {
    const studentsSnap = await retryOperation(() => getDocs(collection(db, 'students')));
    const totalStudents = studentsSnap.size;
    
    let presentToday = 0;
    let absentToday = 0;
    let onLeave = 0;
    
    studentsSnap.forEach(docSnap => {
      const data = docSnap.data() as Student;
      if (data.hostelStatus === 'present') {
        presentToday++;
      } else if (data.hostelStatus === 'absent') {
        absentToday++;
      } else if (data.hostelStatus === 'leave') {
        onLeave++;
      }
    });

    // Calculate occupied rooms
    const roomsSnap = await retryOperation(() => getDocs(collection(db, 'rooms')));
    const totalRooms = roomsSnap.size;
    let occupiedRooms = 0;
    roomsSnap.forEach(docSnap => {
      const r = docSnap.data();
      if (r.occupiedBeds && r.occupiedBeds > 0) {
        occupiedRooms++;
      }
    });

    const hostelInfoRef = doc(db, 'hostel', 'info');
    await retryOperation(() => setDoc(hostelInfoRef, {
      totalRooms,
      occupiedRooms,
      totalStudents,
      presentToday,
      absentToday,
      onLeave,
      updatedAt: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Failed to update hostel counters:', error);
  }
}

/**
 * Creates a brand new student profile. Validates duplicates and initializes the first monthly bill.
 */
export async function createStudent(
  studentData: Omit<Student, 'id' | 'qrId' | 'hostelStatus' | 'leaveStatus'>
): Promise<Student> {
  // 1. Prevent Duplicate Roll Number
  const rollQuery = query(collection(db, 'students'), where('rollNumber', '==', studentData.rollNumber));
  const rollSnap = await retryOperation(() => getDocs(rollQuery));
  if (!rollSnap.empty) {
    const existingDoc = rollSnap.docs[0];
    const existingData = existingDoc.data() as Student;
    const providedId = (studentData as any).id;
    if (providedId && (providedId === existingDoc.id || providedId === existingData.id)) {
      const merged: Student = { ...existingData, ...studentData, id: existingDoc.id };
      await updateStudent(merged);
      return merged;
    }
    throw new Error(`Duplicate Roll Number! A student with Roll Number "${studentData.rollNumber}" is already enrolled.`);
  }

  const qrId = `QR-${studentData.rollNumber}`;

  // 2. Prevent Duplicate QR ID
  const qrQuery = query(collection(db, 'students'), where('qrId', '==', qrId));
  const qrSnap = await retryOperation(() => getDocs(qrQuery));
  if (!qrSnap.empty) {
    throw new Error(`Duplicate QR ID! A student with QR ID "${qrId}" already exists.`);
  }

  // 3. Automatically Create Firebase Authentication Account
  const rollNumberSlug = studentData.rollNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
  let generatedEmail = studentData.email || `${rollNumberSlug}@iracampus.edu`;
  const firstName = studentData.name.trim().split(' ')[0];
  const tempPassword = studentData.temporaryPassword || `${firstName}@2026`;

  let uid = '';
  const tempAppName = `StudentAuthCreator_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const tempApp = initializeApp(firebaseConfig, tempAppName);
  const tempAuth = getAuth(tempApp);

  try {
    const authResult = await createUserWithEmailAndPassword(tempAuth, generatedEmail, tempPassword);
    uid = authResult.user.uid;
    await signOut(tempAuth);
  } catch (authError: any) {
    if (authError.code === 'auth/email-already-in-use' || authError.message?.includes('email-already-in-use')) {
      console.warn(`Email ${generatedEmail} already exists in Auth. Recovering...`);
      let loggedIn = false;
      const candidatePasswords = [tempPassword, `${firstName}@2026`, '123456', 'Password@2026'];
      for (const pass of candidatePasswords) {
        try {
          const res = await signInWithEmailAndPassword(tempAuth, generatedEmail, pass);
          uid = res.user.uid;
          await signOut(tempAuth);
          loggedIn = true;
          break;
        } catch {
          // Ignore candidate password errors
        }
      }

      if (!loggedIn || !uid) {
        try {
          const userQ = query(collection(db, 'users'), where('email', '==', generatedEmail));
          const userSnap = await retryOperation(() => getDocs(userQ));
          if (!userSnap.empty) {
            uid = userSnap.docs[0].id;
          } else {
            const studQ = query(collection(db, 'students'), where('email', '==', generatedEmail));
            const studSnap = await retryOperation(() => getDocs(studQ));
            if (!studSnap.empty) {
              uid = studSnap.docs[0].id;
            }
          }
        } catch (dbErr) {
          console.warn('Error querying existing user in Firestore:', dbErr);
        }
      }

      if (!uid) {
        try {
          const uniqueEmail = studentData.email 
            ? `${studentData.email.split('@')[0]}_${Date.now().toString().slice(-4)}@${studentData.email.split('@')[1] || 'iracampus.edu'}`
            : `${rollNumberSlug}_${Date.now().toString().slice(-4)}@iracampus.edu`;
          
          const authResult2 = await createUserWithEmailAndPassword(tempAuth, uniqueEmail, tempPassword);
          uid = authResult2.user.uid;
          generatedEmail = uniqueEmail;
          await signOut(tempAuth);
        } catch (fallbackAuthErr: any) {
          console.error("Fallback auth account creation failed:", fallbackAuthErr);
          throw new Error(`Failed to create student authentication account: ${fallbackAuthErr.message || fallbackAuthErr}`);
        }
      }
    } else {
      console.error("Auth creation failed for new student:", authError);
      throw new Error(`Failed to create student authentication account: ${authError.message || authError}`);
    }
  }

  const resolvedPhoto = studentData.photoURL || studentData.photoUrl || '';
  const newStudent: Student = {
    ...studentData,
    id: uid,
    uid: uid,
    email: generatedEmail,
    photoURL: resolvedPhoto,
    photoUrl: resolvedPhoto,
    studentPhone: studentData.studentPhone || studentData.phone,
    phone: studentData.phone || studentData.studentPhone || '',
    guardianName: studentData.guardianName || '',
    guardianPhone: studentData.guardianPhone || '',
    qrId,
    hostelStatus: 'present',
    leaveStatus: 'none',
    admissionDate: studentData.admissionDate || new Date().toISOString().split('T')[0],
    temporaryPassword: tempPassword,
    mustChangePassword: true
  };

  const batch = createBatch();

  // Set student doc
  batch.set(doc(db, 'students', uid), newStudent);

  // Set user role mapping document in Firestore (users/{userId})
  batch.set(doc(db, 'users', uid), {
    uid: uid,
    email: generatedEmail,
    role: 'student',
    createdAt: new Date().toISOString()
  });

  // Initialize monthly bill for the current month
  const currentMonth = new Date().toISOString().substring(0, 7);
  const [year, month] = currentMonth.split('-');
  const billId = `${uid}_${year}_${month}`;
  
  const initialBill = {
    id: billId,
    studentId: uid,
    studentName: newStudent.name,
    rollNumber: newStudent.rollNumber,
    department: newStudent.department,
    roomNumber: newStudent.roomNumber,
    month: currentMonth,
    year: year,
    lunchCount: 0,
    dinnerCount: 0,
    totalMeals: 0,
    leaveDays: 0,
    totalAmount: 0,
    status: 'unpaid',
    updatedAt: new Date().toISOString()
  };
  batch.set(doc(db, 'monthlyBills', billId), initialBill);

  // Commit batch
  await retryOperation(() => batch.commit());

  // Assign room bed if room is selected
  if (newStudent.hostelName && newStudent.roomNumber) {
    await updateRoomOccupancy(newStudent.hostelName, newStudent.roomNumber, uid, 'add');
  }

  // Sync global stats
  await updateHostelCounters();

  return newStudent;
}

/**
 * Updates an existing student profile. Syncs room reallocation if needed.
 */
export async function updateStudent(
  student: Student
): Promise<void> {
  const studentRef = doc(db, 'students', student.id);
  const oldSnap = await retryOperation(() => getDoc(studentRef));
  
  if (!oldSnap.exists()) {
    throw new Error(`Student with ID ${student.id} does not exist.`);
  }

  const oldStudent = oldSnap.data() as Student;

  // Handle room reallocation
  const roomChanged = oldStudent.hostelName !== student.hostelName || oldStudent.roomNumber !== student.roomNumber;
  
  if (roomChanged) {
    // Remove from old room occupancy
    if (oldStudent.hostelName && oldStudent.roomNumber) {
      await updateRoomOccupancy(oldStudent.hostelName, oldStudent.roomNumber, student.id, 'remove');
    }
  }

  // Update profile
  await retryOperation(() => setDoc(studentRef, student));

  if (roomChanged) {
    // Add to new room occupancy
    if (student.hostelName && student.roomNumber) {
      await updateRoomOccupancy(student.hostelName, student.roomNumber, student.id, 'add');
    }
  }

  // Sync global stats
  await updateHostelCounters();
}

/**
 * Deletes a student profile and frees up room bed allocations.
 */
export async function deleteStudent(studentId: string): Promise<void> {
  console.log(`[deleteStudent] Requesting deletion for studentId: "${studentId}"`);
  
  let targetDocId = studentId;
  let studentRef = doc(db, 'students', targetDocId);
  let snap = await retryOperation(() => getDoc(studentRef));
  let student: Student | null = null;

  if (snap.exists()) {
    student = snap.data() as Student;
  } else {
    // Fallback lookup by uid or rollNumber
    console.warn(`[deleteStudent] Direct doc lookup for "${studentId}" returned empty. Querying by uid/rollNumber...`);
    const qUid = query(collection(db, 'students'), where('uid', '==', studentId));
    const snapUid = await retryOperation(() => getDocs(qUid));
    if (!snapUid.empty) {
      targetDocId = snapUid.docs[0].id;
      studentRef = doc(db, 'students', targetDocId);
      student = snapUid.docs[0].data() as Student;
    } else {
      const qRoll = query(collection(db, 'students'), where('rollNumber', '==', studentId));
      const snapRoll = await retryOperation(() => getDocs(qRoll));
      if (!snapRoll.empty) {
        targetDocId = snapRoll.docs[0].id;
        studentRef = doc(db, 'students', targetDocId);
        student = snapRoll.docs[0].data() as Student;
      }
    }
  }

  if (!student) {
    console.warn(`[deleteStudent] Student record not found for ID/roll "${studentId}".`);
    return;
  }

  // Deallocate room
  if (student.hostelName && student.roomNumber) {
    try {
      await updateRoomOccupancy(student.hostelName, student.roomNumber, targetDocId, 'remove');
    } catch (roomErr) {
      console.error('[deleteStudent] Room deallocation error:', roomErr);
    }
  }

  // Try deleting user document in 'users' collection
  try {
    const userRef = doc(db, 'users', targetDocId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      await retryOperation(() => deleteDoc(userRef));
    }
  } catch (userErr) {
    console.warn('[deleteStudent] Deleting user doc failed:', userErr);
  }

  // Delete student doc
  await retryOperation(() => deleteDoc(studentRef));

  // Sync global stats
  try {
    await updateHostelCounters();
  } catch (countersErr) {
    console.error('[deleteStudent] Counter update error:', countersErr);
  }

  console.log(`[deleteStudent] Student "${student.name}" (Doc ID: ${targetDocId}) successfully deleted.`);
}

/**
 * Validates and batch-imports students from a CSV string.
 */
export async function importStudentsFromCSV(csvContent: string): Promise<boolean> {
  try {
    const lines = csvContent.split('\n');
    if (lines.length < 2) return false;

    const parsedStudents: Omit<Student, 'id' | 'qrId' | 'hostelStatus' | 'leaveStatus'>[] = [];
    
    // Parse lines
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 4) continue;

      const rollNumber = cols[0];
      const name = cols[1];
      const department = cols[2];
      const semester = cols[3];
      const phone = cols[4] || '9999999999';
      const guardianPhone = cols[5] || '9999999999';
      const hostelName = cols[6] || "Gangpur Boys' Hostel";
      const roomNumber = cols[7] || '101';
      const bedNumber = cols[8] || 'A';

      parsedStudents.push({
        rollNumber,
        name,
        photoUrl: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
        department,
        semester,
        phone,
        guardianPhone,
        hostelName,
        roomNumber,
        bedNumber,
        messStatus: 'active',
        admissionDate: new Date().toISOString().split('T')[0]
      });
    }

    // Sequentially insert to trigger duplicate validations, bill creations, and allocations
    for (const s of parsedStudents) {
      await createStudent(s);
    }

    return true;
  } catch (error) {
    console.error('Error in CSV Bulk Import:', error);
    throw error;
  }
}
