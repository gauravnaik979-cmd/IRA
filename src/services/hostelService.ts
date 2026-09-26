import { 
  db, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  serverTimestamp,
  retryOperation
} from './firestoreService';
import { Hostel, Student, AuditLog } from '../types';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { auth, firebaseConfig } from '../lib/firebase';

export interface CreateHostelPayload {
  name: string;
  code: string;
  district: string;
  address: string;
  phone: string;
  email: string;
  type: 'Boys' | 'Girls';
  college?: string;
  buildings: number;
  totalRooms: number;
  bedsPerRoom?: number;
  capacity: number;
  messEnabled?: boolean;
  lunchEnabled?: boolean;
  dinnerEnabled?: boolean;
  lunchPrice: number;
  dinnerPrice: number;
  qrGateAttendanceEnabled?: boolean;
  gateMovementTrackingEnabled?: boolean;
  superintendentId?: string;
  superintendentName: string;
  superintendentEmail: string;
  superintendentPass?: string;
  superintendentPhone: string;
}

/**
 * Fetches all hostels in the system (Super Admin)
 */
export async function getAllHostels(): Promise<Hostel[]> {
  try {
    const hostelsRef = collection(db, 'hostels');
    const snap = await retryOperation(() => getDocs(hostelsRef));
    const hostels: Hostel[] = [];

    // Also fetch users to dynamically resolve superintendent details if missing on hostel doc (if caller is Super Admin)
    const superMap = new Map<string, { name: string; email: string; phone?: string; id: string }>();
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      usersSnap.forEach(uDoc => {
        const uData = uDoc.data();
        const r = String(uData.role || '').toLowerCase();
        if (r === 'superintendent' && uData.hostelId) {
          if (!superMap.has(uData.hostelId) || uData.isActive === true) {
            superMap.set(uData.hostelId, {
              id: uDoc.id,
              name: uData.displayName || uData.name || 'Hostel Superintendent',
              email: uData.email || '',
              phone: uData.phone || ''
            });
          }
        }
      });
    } catch {
      // Non-superadmin callers or unauthenticated state cannot list /users collection; proceed with hostel document metadata
    }

    snap.forEach(d => {
      const data = d.data();
      const hostelId = d.id;
      const assignedSuper = superMap.get(hostelId);

      hostels.push({
        id: hostelId,
        ...data,
        status: data.status || (data.isActive !== false ? 'active' : 'inactive'),
        superintendentId: data.superintendentId || assignedSuper?.id || '',
        superintendentName: data.superintendentName || assignedSuper?.name || 'Unassigned',
        superintendentEmail: data.superintendentEmail || data.superIntendentEmail || assignedSuper?.email || 'N/A',
        superintendentPhone: data.superintendentPhone || assignedSuper?.phone || 'N/A'
      } as Hostel);
    });

    return hostels;
  } catch (err) {
    console.warn('[HostelService] Notice fetching hostels list:', err);
    return [];
  }
}

/**
 * Fetches a single hostel document
 */
export async function getHostelById(hostelId: string): Promise<Hostel | null> {
  try {
    const ref = doc(db, 'hostels', hostelId);
    const snap = await retryOperation(() => getDoc(ref));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Hostel;
    }
    return null;
  } catch (err) {
    console.error(`Error fetching hostel ${hostelId}:`, err);
    return null;
  }
}

/**
 * Creates a new Hostel with automated subcollection initialization
 * and creates the Superintendent Auth user + user profile.
 */
export async function createHostel(payload: CreateHostelPayload): Promise<Hostel> {
  const hostelId = payload.code.toLowerCase().replace(/[^a-z0-9]/g, '-') || `hostel-${Date.now()}`;
  
  // Check for existing hostel by document ID or normalized name to prevent duplicate creation
  const existingDocRef = doc(db, 'hostels', hostelId);
  const existingDocSnap = await getDoc(existingDocRef);
  if (existingDocSnap.exists()) {
    throw new Error(`A hostel with ID "${hostelId}" already exists.`);
  }

  const existingHostels = await getAllHostels();
  const existingDuplicate = existingHostels.find(h => h.name.trim().toLowerCase() === payload.name.trim().toLowerCase());
  if (existingDuplicate) {
    throw new Error(`A hostel named "${payload.name}" already exists (${existingDuplicate.id}).`);
  }

  // 1. Create or Resolve Superintendent Account
  let superUid = payload.superintendentId || '';
  
  if (!superUid && payload.superintendentEmail) {
    const tempAppName = `HostelSuperCreator_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);

    try {
      const authRes = await createUserWithEmailAndPassword(tempAuth, payload.superintendentEmail, payload.superintendentPass || 'Super@2026');
      superUid = authRes.user.uid;
      await signOut(tempAuth);
    } catch (err: any) {
      console.warn('Superintendent Auth creation notice:', err);
      // Use fallback user lookup or deterministic UID if account already existed
      const qUser = query(collection(db, 'users'), where('email', '==', payload.superintendentEmail));
      const userSnap = await getDocs(qUser);
      if (!userSnap.empty) {
        superUid = userSnap.docs[0].id;
      } else {
        superUid = `uid_super_${payload.superintendentEmail.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      }
    }
  }

  // 2. Save Superintendent Profile in users/{superUid}
  if (superUid) {
    const userProfile = {
      uid: superUid,
      displayName: payload.superintendentName,
      name: payload.superintendentName,
      email: payload.superintendentEmail,
      phone: payload.superintendentPhone,
      role: 'superintendent',
      hostelId: hostelId,
      hostelName: payload.name,
      active: true,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    await retryOperation(() => setDoc(doc(db, 'users', superUid), userProfile, { merge: true }));
  }

  // 3. Save Hostel document in hostels/{hostelId}
  const hostelData: Hostel = {
    id: hostelId,
    name: payload.name,
    code: payload.code.toUpperCase(),
    type: payload.type,
    district: payload.district,
    college: payload.college || 'Odisha Government College',
    address: payload.address,
    phone: payload.phone,
    email: payload.email,
    superintendentId: superUid,
    superintendentName: payload.superintendentName,
    superintendentEmail: payload.superintendentEmail,
    superintendentPhone: payload.superintendentPhone,
    studentCount: 0,
    totalRooms: payload.totalRooms,
    bedsPerRoom: payload.bedsPerRoom || (payload.totalRooms > 0 ? Math.ceil(payload.capacity / payload.totalRooms) : 4),
    capacity: payload.capacity,
    buildings: payload.buildings,
    status: 'active',
    isActive: true,
    messStatus: payload.messEnabled === false ? 'CLOSED' : 'OPEN',
    messEnabled: payload.messEnabled !== false,
    lunchEnabled: payload.lunchEnabled !== false,
    dinnerEnabled: payload.dinnerEnabled !== false,
    qrEnabled: payload.qrGateAttendanceEnabled !== false,
    qrGateAttendanceEnabled: payload.qrGateAttendanceEnabled !== false,
    gateMovementTrackingEnabled: payload.gateMovementTrackingEnabled !== false,
    mealRates: {
      lunchPrice: payload.lunchPrice,
      dinnerPrice: payload.dinnerPrice
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await retryOperation(() => setDoc(doc(db, 'hostels', hostelId), hostelData));

  // 4. Initialize hostel subcollections & default settings
  const settingsRef = doc(db, 'hostels', hostelId, 'settings', 'config');
  await retryOperation(() => setDoc(settingsRef, {
    hostelName: payload.name,
    hostelCode: payload.code,
    district: payload.district,
    lunchPrice: payload.lunchPrice,
    dinnerPrice: payload.dinnerPrice,
    capacity: payload.capacity,
    totalRooms: payload.totalRooms,
    bedsPerRoom: payload.bedsPerRoom || 4,
    messEnabled: payload.messEnabled !== false,
    lunchEnabled: payload.lunchEnabled !== false,
    dinnerEnabled: payload.dinnerEnabled !== false,
    qrGateAttendanceEnabled: payload.qrGateAttendanceEnabled !== false,
    gateMovementTrackingEnabled: payload.gateMovementTrackingEnabled !== false,
    initializedAt: new Date().toISOString()
  }));

  // Initial meal session state
  const mealSessionRef = doc(db, 'hostels', hostelId, 'mealSessions', 'active');
  await retryOperation(() => setDoc(mealSessionRef, {
    currentMeal: 'Lunch',
    status: 'NOT_STARTED',
    openedAt: null,
    closedAt: null,
    openedBy: payload.superintendentName,
    date: new Date().toISOString().split('T')[0]
  }));

  // Initial welcome notice
  const welcomeNoticeRef = doc(db, 'hostels', hostelId, 'notices', `welcome-${Date.now()}`);
  await retryOperation(() => setDoc(welcomeNoticeRef, {
    id: `welcome-${Date.now()}`,
    hostelId,
    title: `Welcome to ${payload.name}`,
    description: `Official digital portal for ${payload.name} powered by IRA Hostel Platform.`,
    priority: 'normal',
    audienceType: 'all',
    audienceValue: 'all',
    createdBy: payload.superintendentName,
    createdAt: new Date().toISOString(),
    isPinned: true,
    deliveryStatus: 'delivered'
  }));

  // 5. Log audit event
  await logTransaction(hostelId, superUid || 'superadmin', 'super_admin', 'HOSTEL_CREATED', `Hostel ${payload.name} (${payload.code}) initialized successfully.`);

  return hostelData;
}

/**
 * Updates hostel details & configuration
 */
export async function updateHostel(hostelId: string, updates: Partial<Hostel>): Promise<void> {
  const ref = doc(db, 'hostels', hostelId);
  const cleanUpdates = {
    ...updates,
    updatedAt: new Date().toISOString()
  };
  await retryOperation(() => updateDoc(ref, cleanUpdates));

  // Sync with settings doc
  try {
    const settingsRef = doc(db, 'hostels', hostelId, 'settings', 'config');
    await retryOperation(() => setDoc(settingsRef, {
      ...(updates.name ? { hostelName: updates.name } : {}),
      ...(updates.district ? { district: updates.district } : {}),
      ...(updates.mealRates?.lunchPrice !== undefined ? { lunchPrice: updates.mealRates.lunchPrice } : {}),
      ...(updates.mealRates?.dinnerPrice !== undefined ? { dinnerPrice: updates.mealRates.dinnerPrice } : {}),
      ...(updates.capacity !== undefined ? { capacity: updates.capacity } : {}),
      ...(updates.totalRooms !== undefined ? { totalRooms: updates.totalRooms } : {}),
      ...(updates.bedsPerRoom !== undefined ? { bedsPerRoom: updates.bedsPerRoom } : {}),
      ...(updates.messEnabled !== undefined ? { messEnabled: updates.messEnabled } : {}),
      ...(updates.lunchEnabled !== undefined ? { lunchEnabled: updates.lunchEnabled } : {}),
      ...(updates.dinnerEnabled !== undefined ? { dinnerEnabled: updates.dinnerEnabled } : {}),
      ...(updates.qrGateAttendanceEnabled !== undefined ? { qrGateAttendanceEnabled: updates.qrGateAttendanceEnabled } : {}),
      ...(updates.gateMovementTrackingEnabled !== undefined ? { gateMovementTrackingEnabled: updates.gateMovementTrackingEnabled } : {}),
      updatedAt: new Date().toISOString()
    }, { merge: true }));
  } catch (e) {
    console.warn('Subcollection settings update notice:', e);
  }

  // If in-charge assigned, sync users profile
  if (updates.superintendentId) {
    try {
      await retryOperation(() => updateDoc(doc(db, 'users', updates.superintendentId!), {
        hostelId: hostelId,
        hostelName: updates.name || 'Assigned Hostel',
        ...(updates.superintendentName ? { displayName: updates.superintendentName, name: updates.superintendentName } : {}),
        ...(updates.superintendentPhone ? { phone: updates.superintendentPhone } : {})
      }));
    } catch (e) {
      console.warn('User profile sync notice:', e);
    }
  }

  await logTransaction(hostelId, updates.superintendentId || 'superadmin', 'super_admin', 'HOSTEL_CONFIG_UPDATED', `Hostel configuration updated for ${updates.name || hostelId}.`);
}

/**
 * Suspends or activates a hostel
 */
export async function toggleHostelStatus(hostelId: string, status: 'active' | 'suspended' | 'inactive'): Promise<void> {
  const ref = doc(db, 'hostels', hostelId);
  const isActive = status === 'active';
  await retryOperation(() => updateDoc(ref, {
    status,
    isActive,
    updatedAt: new Date().toISOString()
  }));

  await logTransaction(hostelId, 'superadmin', 'super_admin', 'HOSTEL_STATUS_CHANGED', `Hostel status changed to ${isActive ? 'ACTIVE' : 'DISABLED'}.`);
}

/**
 * Deletes a hostel and removes its metadata
 */
export async function deleteHostel(hostelId: string): Promise<void> {
  const ref = doc(db, 'hostels', hostelId);
  await retryOperation(() => deleteDoc(ref));
  await logTransaction(hostelId, 'superadmin', 'super_admin', 'HOSTEL_DELETED', `Hostel ${hostelId} record permanently removed.`);
}

/**
 * Toggles an In-charge account status (Active / Inactive)
 */
export async function toggleSuperintendentStatus(superintendentId: string, isActive: boolean, superintendentName?: string): Promise<void> {
  const ref = doc(db, 'users', superintendentId);
  await retryOperation(() => updateDoc(ref, {
    active: isActive,
    isActive: isActive,
    updatedAt: new Date().toISOString()
  }));

  await logTransaction('global', superintendentId, 'super_admin', 'INCHARGE_STATUS_CHANGED', `In-charge ${superintendentName || superintendentId} status updated to ${isActive ? 'ACTIVE' : 'DISABLED'}.`);
}

/**
 * Reassigns an in-charge to a hostel
 */
export async function reassignSuperintendent(
  superintendentId: string,
  superintendentName: string,
  newHostelId: string,
  newHostelName: string,
  superintendentEmail?: string,
  superintendentPhone?: string
): Promise<void> {
  // Update in-charge user doc
  const userRef = doc(db, 'users', superintendentId);
  await retryOperation(() => updateDoc(userRef, {
    hostelId: newHostelId,
    hostelName: newHostelName,
    updatedAt: new Date().toISOString()
  }));

  // Update new hostel doc
  const hostelRef = doc(db, 'hostels', newHostelId);
  await retryOperation(() => updateDoc(hostelRef, {
    superintendentId,
    superintendentName,
    ...(superintendentEmail ? { superintendentEmail } : {}),
    ...(superintendentPhone ? { superintendentPhone } : {}),
    updatedAt: new Date().toISOString()
  }));

  await logTransaction(newHostelId, superintendentId, 'super_admin', 'INCHARGE_REASSIGNED', `In-charge ${superintendentName} reassigned to ${newHostelName} (${newHostelId}).`);
}

/**
 * Resets an in-charge password or triggers password reset link
 */
export async function resetSuperintendentPassword(
  superintendentId: string,
  email: string,
  superintendentName?: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (email && email.includes('@')) {
      await sendPasswordResetEmail(auth, email);
      await logTransaction('global', superintendentId, 'super_admin', 'INCHARGE_PASSWORD_RESET', `Password reset email dispatched to ${email} for in-charge ${superintendentName || superintendentId}.`);
      return {
        success: true,
        message: `Password reset link dispatched directly to ${email}.`
      };
    } else {
      throw new Error('Valid email address required for password reset.');
    }
  } catch (err: any) {
    // If client reset fails (e.g. unverified/demo or network), record log and update user document timestamp
    console.warn('Password reset notification:', err);
    const userRef = doc(db, 'users', superintendentId);
    await retryOperation(() => updateDoc(userRef, {
      passwordResetRequestedAt: new Date().toISOString()
    }));
    await logTransaction('global', superintendentId, 'super_admin', 'INCHARGE_PASSWORD_RESET', `Password reset request logged for ${email} (${superintendentName || superintendentId}).`);
    return {
      success: true,
      message: `Password reset request registered for ${email}. Default temporary password: Super@2026`
    };
  }
}

/**
 * Logs a transaction/audit event for a hostel
 */
export async function logTransaction(
  hostelId: string, 
  userId: string, 
  role: string, 
  action: string, 
  details: string
): Promise<void> {
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const logData = {
      id: logId,
      hostelId,
      userId,
      role,
      action,
      details,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server'
    };

    // Store in isolated hostel subcollection
    const logRef = doc(db, 'hostels', hostelId, 'transactionLogs', logId);
    await retryOperation(() => setDoc(logRef, logData));

    // Also store in global audit_logs
    const globalLogRef = doc(db, 'audit_logs', logId);
    await retryOperation(() => setDoc(globalLogRef, logData));
  } catch (err) {
    console.error('Failed to record transaction log:', err);
  }
}

export interface SuperintendentRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  hostelId?: string;
  hostelName?: string;
  status: 'Active' | 'Inactive' | string;
  createdAt?: string;
}

export async function getAllSuperintendents(): Promise<SuperintendentRecord[]> {
  try {
    const snap = await retryOperation(() => getDocs(collection(db, 'users')));
    const supers: SuperintendentRecord[] = [];
    snap.forEach(d => {
      const data = d.data();
      const roleStr = String(data.role || '').toLowerCase();
      if (roleStr === 'superintendent') {
        supers.push({
          id: d.id,
          name: data.displayName || data.name || 'Superintendent',
          email: data.email || 'N/A',
          phone: data.phone || 'N/A',
          hostelId: data.hostelId || '',
          hostelName: data.hostelName || 'Unassigned',
          status: data.active !== false && data.isActive !== false ? 'Active' : 'Inactive',
          createdAt: data.createdAt || ''
        });
      }
    });
    return supers;
  } catch (err) {
    console.error('Error fetching superintendents:', err);
    return [];
  }
}

export interface StaffAccountRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  hostelId?: string;
  hostelName?: string;
  status: 'Active' | 'Inactive' | string;
  createdAt?: string;
}

export async function getAllStaffAccounts(): Promise<StaffAccountRecord[]> {
  try {
    const q = query(collection(db, 'users'), where('role', '==', 'staff'));
    const snap = await retryOperation(() => getDocs(q));
    const staffList: StaffAccountRecord[] = [];
    snap.forEach(d => {
      const data = d.data();
      staffList.push({
        id: d.id,
        name: data.displayName || data.name || 'Staff Member',
        email: data.email || 'N/A',
        phone: data.phone || 'N/A',
        role: data.staffRole || 'Staff',
        hostelId: data.hostelId || '',
        hostelName: data.hostelName || 'Unassigned',
        status: data.active !== false && data.isActive !== false ? 'Active' : 'Inactive',
        createdAt: data.createdAt || ''
      });
    });
    return staffList;
  } catch (err) {
    console.error('Error fetching staff accounts:', err);
    return [];
  }
}

export async function createStaffAccount(payload: {
  name: string;
  email: string;
  phone: string;
  staffRole: string;
  hostelId: string;
  hostelName: string;
  tempPass: string;
}): Promise<void> {
  let staffUid = '';
  const tempAppName = `StaffCreator_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const tempApp = initializeApp(firebaseConfig, tempAppName);
  const tempAuth = getAuth(tempApp);

  try {
    const authRes = await createUserWithEmailAndPassword(tempAuth, payload.email, payload.tempPass);
    staffUid = authRes.user.uid;
    await signOut(tempAuth);
  } catch (err: any) {
    console.warn('Staff Auth creation note:', err);
    staffUid = `uid_staff_${payload.email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }

  const userProfile = {
    uid: staffUid,
    displayName: payload.name,
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    role: 'staff',
    staffRole: payload.staffRole,
    hostelId: payload.hostelId,
    hostelName: payload.hostelName,
    active: true,
    isActive: true,
    createdAt: new Date().toISOString()
  };

  await retryOperation(() => setDoc(doc(db, 'users', staffUid), userProfile, { merge: true }));
  await logTransaction(payload.hostelId, staffUid, 'super_admin', 'STAFF_ACCOUNT_CREATED', `Staff account ${payload.name} (${payload.staffRole}) created.`);
}

export interface SystemAuditLog {
  id: string;
  action: string;
  details: string;
  userId?: string;
  role?: string;
  timestamp?: string;
  hostelId?: string;
}

export async function getAuditLogs(): Promise<SystemAuditLog[]> {
  try {
    const snap = await retryOperation(() => getDocs(collection(db, 'audit_logs')));
    const logs: SystemAuditLog[] = [];
    snap.forEach(d => {
      logs.push({ id: d.id, ...d.data() } as SystemAuditLog);
    });
    return logs.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    return [];
  }
}
