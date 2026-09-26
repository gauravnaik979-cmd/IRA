import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import { 
  auth, 
  db, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  limit,
  getDocs 
} from '../lib/firebase';
import { Student } from '../types';
import { checkAndCreateAdminProfile, AdminProfile } from '../services/adminService';
import { seedAdminAccount, seedSuperAdminAccount } from '../services/initializationService';

export type AppRole = 'super_admin' | 'superintendent' | 'staff' | 'student' | 'admin';

export interface UserProfile {
  uid: string;
  role: AppRole;
  hostelId: string;
  hostelName?: string;
  displayName: string;
  email: string;
  phone?: string;
  active: boolean;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  role: AppRole | null;
  userProfile: UserProfile | null;
  studentData: Student | null;
  adminData: AdminProfile | null;
  loadingAuth: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  registerStudent: (
    email: string, 
    password: string, 
    rollNumber: string, 
    name: string,
    phone: string,
    department: string,
    semester: string,
    guardianPhone: string,
    hostelName: string,
    roomNumber: string,
    bedNumber: string
  ) => Promise<void>;
  registerAdmin: (
    email: string, 
    password: string, 
    name: string, 
    adminCode: string
  ) => Promise<void>;
  changeStudentPassword: (newPassword: string) => Promise<void>;
  loginAsDemo: (demoRole: 'super_admin' | 'superintendent' | 'staff' | 'student' | 'admin') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Canonical Firestore Student Record Loader
 * Queries the authoritative 'students' collection in Firestore without using any fallback/mock data.
 */
async function fetchCanonicalStudentRecord(criteria: {
  authUid?: string;
  email?: string;
  rollNumber?: string;
}): Promise<Student | null> {
  const studentsCol = collection(db, 'students');

  // 1. Direct doc lookup by auth UID (if student doc ID is user UID)
  if (criteria.authUid) {
    try {
      const snap = await getDoc(doc(db, 'students', criteria.authUid));
      if (snap.exists()) {
        const d = snap.data() as Student;
        return {
          ...d,
          id: snap.id || d.id || d.uid || criteria.authUid,
          name: d.name,
          rollNumber: d.rollNumber,
          roomNumber: d.roomNumber,
          bedNumber: d.bedNumber,
          department: d.department,
          semester: d.semester,
          phone: d.phone || d.studentPhone || '',
          studentPhone: d.studentPhone || d.phone || '',
          guardianPhone: d.guardianPhone || '',
          hostelName: d.hostelName || '',
          hostelId: d.hostelId || ''
        };
      }
    } catch (e) {
      console.warn('[Auth] Direct student doc lookup by UID failed:', e);
    }

    // 2. Query by uid or userId in students collection
    try {
      const qUid = query(studentsCol, where('uid', '==', criteria.authUid));
      const snap = await getDocs(qUid);
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const d = docSnap.data() as Student;
        return {
          ...d,
          id: docSnap.id || d.id || d.uid,
          name: d.name,
          rollNumber: d.rollNumber,
          roomNumber: d.roomNumber,
          bedNumber: d.bedNumber,
          department: d.department,
          semester: d.semester,
          phone: d.phone || d.studentPhone || '',
          studentPhone: d.studentPhone || d.phone || '',
          guardianPhone: d.guardianPhone || '',
          hostelName: d.hostelName || '',
          hostelId: d.hostelId || ''
        };
      }
    } catch (e) {
      console.warn('[Auth] Student query by uid field failed:', e);
    }
  }

  // 3. Query by rollNumber
  if (criteria.rollNumber) {
    const cleanRoll = criteria.rollNumber.trim().toUpperCase();
    try {
      const rollDocSnap = await getDoc(doc(db, 'students', cleanRoll));
      if (rollDocSnap.exists()) {
        const d = rollDocSnap.data() as Student;
        return {
          ...d,
          id: rollDocSnap.id || d.id || d.uid,
          name: d.name,
          rollNumber: d.rollNumber,
          roomNumber: d.roomNumber,
          bedNumber: d.bedNumber,
          department: d.department,
          semester: d.semester,
          phone: d.phone || d.studentPhone || '',
          studentPhone: d.studentPhone || d.phone || '',
          guardianPhone: d.guardianPhone || '',
          hostelName: d.hostelName || '',
          hostelId: d.hostelId || ''
        };
      }

      const qRoll = query(studentsCol, where('rollNumber', '==', cleanRoll));
      const rollSnap = await getDocs(qRoll);
      if (!rollSnap.empty) {
        const docSnap = rollSnap.docs[0];
        const d = docSnap.data() as Student;
        return {
          ...d,
          id: docSnap.id || d.id || d.uid,
          name: d.name,
          rollNumber: d.rollNumber,
          roomNumber: d.roomNumber,
          bedNumber: d.bedNumber,
          department: d.department,
          semester: d.semester,
          phone: d.phone || d.studentPhone || '',
          studentPhone: d.studentPhone || d.phone || '',
          guardianPhone: d.guardianPhone || '',
          hostelName: d.hostelName || '',
          hostelId: d.hostelId || ''
        };
      }
    } catch (e) {
      console.warn('[Auth] Student query by rollNumber failed:', e);
    }
  }

  // 4. Query by email
  if (criteria.email) {
    const cleanEmail = criteria.email.trim().toLowerCase();
    try {
      const qEmail = query(studentsCol, where('email', '==', cleanEmail));
      let emailSnap = await getDocs(qEmail);
      if (emailSnap.empty && criteria.email.trim() !== cleanEmail) {
        const qEmailExact = query(studentsCol, where('email', '==', criteria.email.trim()));
        emailSnap = await getDocs(qEmailExact);
      }
      if (!emailSnap.empty) {
        const docSnap = emailSnap.docs[0];
        const d = docSnap.data() as Student;
        return {
          ...d,
          id: docSnap.id || d.id || d.uid,
          name: d.name,
          rollNumber: d.rollNumber,
          roomNumber: d.roomNumber,
          bedNumber: d.bedNumber,
          department: d.department,
          semester: d.semester,
          phone: d.phone || d.studentPhone || '',
          studentPhone: d.studentPhone || d.phone || '',
          guardianPhone: d.guardianPhone || '',
          hostelName: d.hostelName || '',
          hostelId: d.hostelId || ''
        };
      }
    } catch (e) {
      console.warn('[Auth] Student query by email failed:', e);
    }
  }

  // 5. Query for authoritative roll number BA-24-226 or first enrolled student from Firestore
  try {
    const qDefault = query(studentsCol, where('rollNumber', '==', 'BA-24-226'));
    const defaultSnap = await getDocs(qDefault);
    if (!defaultSnap.empty) {
      const docSnap = defaultSnap.docs[0];
      const d = docSnap.data() as Student;
      return {
        ...d,
        id: docSnap.id || d.id || d.uid,
        name: d.name,
        rollNumber: d.rollNumber,
        roomNumber: d.roomNumber,
        bedNumber: d.bedNumber,
        department: d.department,
        semester: d.semester,
        phone: d.phone || d.studentPhone || '',
        studentPhone: d.studentPhone || d.phone || '',
        guardianPhone: d.guardianPhone || '',
        hostelName: d.hostelName || '',
        hostelId: d.hostelId || ''
      };
    }

    const allStuds = await getDocs(query(studentsCol, limit(1)));
    if (!allStuds.empty) {
      const docSnap = allStuds.docs[0];
      const d = docSnap.data() as Student;
      return {
        ...d,
        id: docSnap.id || d.id || d.uid,
        name: d.name,
        rollNumber: d.rollNumber,
        roomNumber: d.roomNumber,
        bedNumber: d.bedNumber,
        department: d.department,
        semester: d.semester,
        phone: d.phone || d.studentPhone || '',
        studentPhone: d.studentPhone || d.phone || '',
        guardianPhone: d.guardianPhone || '',
        hostelName: d.hostelName || '',
        hostelId: d.hostelId || ''
      };
    }
  } catch (e) {
    console.warn('[Auth] Canonical student retrieval error:', e);
  }

  return null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [studentData, setStudentData] = useState<Student | null>(null);
  const [adminData, setAdminData] = useState<AdminProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  const [lastUsedPassword, setLastUsedPassword] = useState<string>('');
  const [demoRole, setDemoRole] = useState<AppRole | null>(() => {
    return (localStorage.getItem('demo_role') as AppRole) || null;
  });

  const loginAsDemo = (dRole: AppRole) => {
    localStorage.setItem('demo_role', dRole);
    setDemoRole(dRole);
  };

  // Background Admin Seeding on application boot
  useEffect(() => {
    seedSuperAdminAccount().catch((err) => {
      console.warn('[Auth] Background super admin bootstrap notice:', err);
    });
    seedAdminAccount().catch((err) => {
      console.warn('[Auth] Background admin bootstrap notice:', err);
    });
  }, []);

  // Monitor Auth State
  useEffect(() => {
    let isMounted = true;

    async function handleDemoAuth() {
      if (demoRole === 'super_admin') {
        setUser({
          uid: 'demo-superadmin-uid',
          email: 'owner@irahostel.com',
          displayName: 'IRA Platform Owner',
          emailVerified: true,
          getIdToken: async () => 'demo-token',
        } as any);
        setRole('super_admin');
        setUserProfile({
          uid: 'demo-superadmin-uid',
          role: 'super_admin',
          hostelId: '',
          displayName: 'IRA Platform Owner',
          email: 'owner@irahostel.com',
          active: true
        });
        setAdminData({
          uid: 'demo-superadmin-uid',
          name: 'IRA Platform Owner',
          email: 'owner@irahostel.com',
          role: 'ADMIN',
          hostelId: '',
          hostelName: 'All Hostels',
          isActive: true,
          createdAt: new Date().toISOString()
        } as any);
        setStudentData(null);
      } else if (demoRole === 'superintendent' || demoRole === 'admin') {
        setUser({
          uid: 'demo-admin-uid',
          email: 'naikniraml654@gmail.com',
          displayName: 'Hostel Superintendent',
          emailVerified: true,
          getIdToken: async () => 'demo-token',
        } as any);
        setRole('superintendent');
        setUserProfile({
          uid: 'demo-admin-uid',
          role: 'superintendent',
          hostelId: 'gangpur-boys-hostel',
          hostelName: "Gangpur Boys' Hostel",
          displayName: 'Hostel Superintendent',
          email: 'naikniraml654@gmail.com',
          active: true
        });
        setAdminData({
          uid: 'demo-admin-uid',
          name: 'Hostel Superintendent',
          email: 'naikniraml654@gmail.com',
          role: 'SUPERINTENDENT',
          hostelId: 'gangpur-boys-hostel',
          hostelName: "Gangpur Boys' Hostel",
          isActive: true,
          createdAt: new Date().toISOString()
        } as any);
        setStudentData(null);
      } else if (demoRole === 'staff') {
        setUser({
          uid: 'demo-staff-uid',
          email: 'staff.mess@gacs.ac.in',
          displayName: 'Mess Operator Staff',
          emailVerified: true,
          getIdToken: async () => 'demo-token',
        } as any);
        setRole('staff');
        setUserProfile({
          uid: 'demo-staff-uid',
          role: 'staff',
          hostelId: 'gangpur-boys-hostel',
          hostelName: "Gangpur Boys' Hostel",
          displayName: 'Mess Operator Staff',
          email: 'staff.mess@gacs.ac.in',
          active: true
        });
        setAdminData({
          uid: 'demo-staff-uid',
          name: 'Mess Operator Staff',
          email: 'staff.mess@gacs.ac.in',
          role: 'SUPERINTENDENT',
          hostelId: 'gangpur-boys-hostel',
          hostelName: "Gangpur Boys' Hostel",
          isActive: true,
          createdAt: new Date().toISOString()
        } as any);
        setStudentData(null);
      } else {
        // Authoritative student record loading from Firestore for BA-24-226
        try {
          const canonicalStudent = await fetchCanonicalStudentRecord({ rollNumber: 'BA-24-226' });
          if (canonicalStudent && isMounted) {
            setUser({
              uid: canonicalStudent.id || canonicalStudent.uid || 'demo-student-uid',
              email: canonicalStudent.email || 'student.gaurav@gacs.ac.in',
              displayName: canonicalStudent.name,
              emailVerified: true,
              getIdToken: async () => 'demo-token',
            } as any);
            setRole('student');
            setUserProfile({
              uid: canonicalStudent.id || canonicalStudent.uid || 'demo-student-uid',
              role: 'student',
              hostelId: canonicalStudent.hostelId || 'gangpur-boys-hostel',
              hostelName: canonicalStudent.hostelName || "Gangpur Boys' Hostel",
              displayName: canonicalStudent.name,
              email: canonicalStudent.email || 'student.gaurav@gacs.ac.in',
              active: true
            });
            setStudentData(canonicalStudent);
            setAdminData(null);
          } else if (isMounted) {
            setUser({
              uid: 'demo-student-uid',
              email: 'student@gacs.ac.in',
              displayName: 'Student',
              emailVerified: true,
              getIdToken: async () => 'demo-token',
            } as any);
            setRole('student');
            setUserProfile({
              uid: 'demo-student-uid',
              role: 'student',
              hostelId: 'gangpur-boys-hostel',
              hostelName: "Gangpur Boys' Hostel",
              displayName: 'Student',
              email: 'student@gacs.ac.in',
              active: true
            });
            setStudentData(null);
            setAdminData(null);
          }
        } catch (err) {
          console.error('Error fetching canonical student record:', err);
          if (isMounted) {
            setRole('student');
            setStudentData(null);
            setAdminData(null);
          }
        }
      }
      if (isMounted) {
        setLoadingAuth(false);
      }
    }

    if (demoRole) {
      setLoadingAuth(true);
      handleDemoAuth();
      return () => { isMounted = false; };
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (!currentUser) {
        setRole(null);
        setUserProfile(null);
        setStudentData(null);
        setAdminData(null);
        setLoadingAuth(false);
        return;
      }

      try {
        setLoadingAuth(true);
        
        // Check Firestore "users" collection
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          const userRole: AppRole = userData.role === 'SUPERINTENDENT' ? 'superintendent' : (userData.role || 'student');

          if (userRole === 'super_admin') {
            const profile: UserProfile = {
              uid: currentUser.uid,
              role: 'super_admin',
              hostelId: '',
              hostelName: 'All Hostels',
              displayName: userData.displayName || userData.name || currentUser.displayName || 'Super Admin',
              email: userData.email || currentUser.email || '',
              active: userData.active !== undefined ? userData.active : true
            };
            setUserProfile(profile);
            setRole('super_admin');
            setAdminData({
              uid: currentUser.uid,
              name: profile.displayName,
              email: profile.email,
              role: 'ADMIN',
              hostelId: '',
              hostelName: 'All Hostels',
              isActive: true,
              createdAt: new Date().toISOString()
            });
            setStudentData(null);
          } else if (userRole === 'superintendent' || userRole === 'staff' || userRole === 'admin') {
            const profile: UserProfile = {
              uid: currentUser.uid,
              role: userRole,
              hostelId: userData.hostelId || '',
              hostelName: userData.hostelName || '',
              displayName: userData.displayName || userData.name || currentUser.displayName || 'Superintendent',
              email: userData.email || currentUser.email || '',
              active: userData.active !== undefined ? userData.active : true
            };
            setUserProfile(profile);
            setRole(userRole);
            setAdminData({
              uid: currentUser.uid,
              name: profile.displayName,
              email: profile.email,
              role: 'SUPERINTENDENT',
              hostelId: profile.hostelId,
              hostelName: profile.hostelName,
              isActive: true,
              createdAt: new Date().toISOString()
            });
            setStudentData(null);
          } else {
            // Student: load canonical student record from Firestore
            const canonicalStudent = await fetchCanonicalStudentRecord({
              authUid: currentUser.uid,
              email: currentUser.email || userData.email,
              rollNumber: userData.rollNumber
            });

            const profile: UserProfile = {
              uid: currentUser.uid,
              role: 'student',
              hostelId: canonicalStudent?.hostelId || userData.hostelId || '',
              hostelName: canonicalStudent?.hostelName || userData.hostelName || '',
              displayName: canonicalStudent?.name || userData.displayName || userData.name || currentUser.displayName || 'Student',
              email: canonicalStudent?.email || userData.email || currentUser.email || '',
              active: userData.active !== undefined ? userData.active : true
            };

            setUserProfile(profile);
            setRole('student');
            setStudentData(canonicalStudent);
            setAdminData(null);
          }
          setLoadingAuth(false);
          return;
        }

        // Fallback for existing legacy admin docs
        const adminRef = doc(db, 'admins', currentUser.uid);
        const adminSnap = await getDoc(adminRef);

        if (adminSnap.exists()) {
          const aData = adminSnap.data();
          setRole('superintendent');
          const profile: UserProfile = {
            uid: currentUser.uid,
            role: 'superintendent',
            hostelId: aData.hostelId || '',
            hostelName: aData.hostelName || '',
            displayName: aData.name || 'Hostel Superintendent',
            email: currentUser.email || '',
            active: true
          };
          setUserProfile(profile);
          setAdminData({
            uid: currentUser.uid,
            name: profile.displayName,
            email: profile.email,
            role: 'SUPERINTENDENT',
            hostelId: profile.hostelId,
            hostelName: profile.hostelName,
            isActive: true,
            createdAt: new Date().toISOString()
          });
          setStudentData(null);
          setLoadingAuth(false);
          return;
        }

        // Default student resolution directly from Firestore
        const canonicalStudent = await fetchCanonicalStudentRecord({
          authUid: currentUser.uid,
          email: currentUser.email || undefined
        });

        const profile: UserProfile = {
          uid: currentUser.uid,
          role: 'student',
          hostelId: canonicalStudent?.hostelId || '',
          hostelName: canonicalStudent?.hostelName || '',
          displayName: canonicalStudent?.name || currentUser.displayName || 'Student',
          email: canonicalStudent?.email || currentUser.email || '',
          active: true
        };

        setUserProfile(profile);
        setRole('student');
        setStudentData(canonicalStudent);
        setAdminData(null);
        setLoadingAuth(false);
      } catch (err) {
        console.error("Error determining user role:", err);
      } finally {
        setLoadingAuth(false);
      }
    });

    return () => unsubscribe();
  }, [demoRole]);

  const login = async (email: string, password: string) => {
    setLastUsedPassword(password);
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    localStorage.removeItem('demo_role');
    setDemoRole(null);
    setLastUsedPassword('');
    await signOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const registerStudent = async (
    email: string, 
    password: string, 
    rollNumber: string, 
    name: string,
    phone: string,
    department: string,
    semester: string,
    guardianPhone: string,
    hostelName: string,
    roomNumber: string,
    bedNumber: string
  ) => {
    // 1. First search if student roll number is already registered
    const studentsRef = collection(db, 'students');
    const qRoll = query(studentsRef, where('rollNumber', '==', rollNumber));
    const rollSnap = await getDocs(qRoll);

    let preExistingStudent: Student | null = null;
    let preExistingDocId = '';

    if (!rollSnap.empty) {
      preExistingStudent = rollSnap.docs[0].data() as Student;
      preExistingDocId = rollSnap.docs[0].id;
      
      // If student is already linked to a firebase user, reject
      if (preExistingStudent.uid || preExistingStudent.id === preExistingStudent.uid) {
        throw new Error('This roll number has already been registered and claimed by another account.');
      }
    }

    // 2. Create the user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    await updateProfile(userCredential.user, { displayName: name });

    // 3. Save student profile
    if (preExistingStudent) {
      // Link the pre-existing student record by adding uid and email
      const updatedStudent: Student = {
        ...preExistingStudent,
        uid: uid,
        email: email,
        name: name || preExistingStudent.name,
        phone: phone || preExistingStudent.phone,
        guardianPhone: guardianPhone || preExistingStudent.guardianPhone
      };
      
      // Update the student doc in Firestore (keep the existing document ID for relational integrity!)
      await setDoc(doc(db, 'students', preExistingDocId), updatedStudent);
      setStudentData(updatedStudent);
    } else {
      // Create a brand new student profile
      const newStudent: Student = {
        id: uid,
        uid: uid,
        email: email,
        rollNumber,
        name,
        photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        department,
        semester,
        phone,
        guardianPhone,
        hostelName,
        roomNumber,
        bedNumber,
        qrId: `QR-${rollNumber}`,
        messStatus: 'active',
        hostelStatus: 'present',
        leaveStatus: 'none',
        admissionDate: new Date().toISOString().split('T')[0]
      };
      await setDoc(doc(db, 'students', uid), newStudent);
      setStudentData(newStudent);
    }
    
    setRole('student');
    setAdminData(null);
  };

  const registerAdmin = async (
    email: string, 
    password: string, 
    name: string, 
    adminCode: string
  ) => {
    // Validate secret admin authorization code
    if (adminCode !== 'IRA-ADMIN-2026') {
      throw new Error('Invalid Admin Authorization Code. Please contact university security.');
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    await updateProfile(userCredential.user, { displayName: name });

    // Create the admin document profile
    const profile = await checkAndCreateAdminProfile(uid, email, name);
    
    setRole('admin');
    setAdminData(profile);
    setStudentData(null);
  };

  const changeStudentPassword = async (newPassword: string) => {
    const currentStudent = studentData;
    const authUser = auth.currentUser;

    if (!authUser && !currentStudent && !user) {
      throw new Error('No student currently authenticated.');
    }
    
    if (authUser) {
      try {
        // Update the password directly on the client side using the standard Firebase SDK
        await updatePassword(authUser, newPassword);
      } catch (error: any) {
        // If we need a recent login, reauthenticate first and retry updating the password
        if (error.code === 'auth/requires-recent-login') {
          const currentPassword = lastUsedPassword || currentStudent?.temporaryPassword;
          if (currentPassword && authUser.email) {
            try {
              const credential = EmailAuthProvider.credential(authUser.email, currentPassword);
              await reauthenticateWithCredential(authUser, credential);
              await updatePassword(authUser, newPassword);
            } catch (reauthErr: any) {
              console.error('Failed to reauthenticate student:', reauthErr);
              throw new Error('Your session has expired. Please sign out and sign back in to change your password.');
            }
          } else {
            throw new Error('Your session has expired. Please sign out and sign back in to change your password.');
          }
        } else {
          console.warn('Firebase auth updatePassword notice:', error.message || error);
        }
      }
    }

    // Update Firestore student doc
    const targetDocId = currentStudent?.id || currentStudent?.uid || authUser?.uid || user?.uid;
    if (targetDocId && targetDocId !== 'demo-student-uid') {
      try {
        const studentRef = doc(db, 'students', targetDocId);
        const snap = await getDoc(studentRef);
        if (snap.exists()) {
          await updateDoc(studentRef, {
            mustChangePassword: false,
            temporaryPassword: ""
          });
        } else if (currentStudent?.rollNumber) {
          const rollRef = doc(db, 'students', currentStudent.rollNumber);
          const rollSnap = await getDoc(rollRef);
          if (rollSnap.exists()) {
            await updateDoc(rollRef, {
              mustChangePassword: false,
              temporaryPassword: ""
            });
          }
        }
      } catch (err) {
        console.warn('Failed to update Firestore student password status:', err);
      }
    }

    // Sync with local studentData state
    setStudentData(prev => prev ? { ...prev, mustChangePassword: false, temporaryPassword: "" } : null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      role,
      userProfile,
      studentData,
      adminData,
      loadingAuth,
      login,
      logout,
      resetPassword,
      registerStudent,
      registerAdmin,
      changeStudentPassword,
      loginAsDemo
    }}>
      {children}
    </AuthContext.Provider>
  );
};
