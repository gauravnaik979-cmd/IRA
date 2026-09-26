import { doc, getDoc, retryOperation, db } from './firestoreService';

export interface AdminProfile {
  uid: string;
  name: string;
  email: string;
  role: 'SUPERINTENDENT' | 'ADMIN' | 'admin';
  hostelId?: string;
  hostelName?: string;
  isActive?: boolean;
  createdAt: any;
}

/**
 * Checks if an admin document exists for a given uid.
 */
export async function checkAndCreateAdminProfile(
  uid: string, 
  email: string, 
  name: string
): Promise<AdminProfile> {
  const adminRef = doc(db, 'admins', uid);
  try {
    const snap = await retryOperation(() => getDoc(adminRef));
    if (snap.exists()) {
      return snap.data() as AdminProfile;
    }
  } catch (err) {
    console.warn('[AdminProfile] Admin profile lookup notice:', err);
  }
  
  return {
    uid,
    name: name || email.split('@')[0],
    email,
    role: 'ADMIN',
    createdAt: new Date().toISOString()
  };
}
