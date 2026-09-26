import { Notice, Student } from '../types';
import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs, 
  query, 
  where,
  handleFirestoreError,
  OperationType
} from '../lib/firebase';
import { sendLocalPushNotification } from './fcmService';

export const DEFAULT_HOSTEL_ID = 'gangpur-boys-hostel';

// Real-time listener for notices under hostels/{hostelId}/notices
export function subscribeToHostelNotices(
  hostelId: string = DEFAULT_HOSTEL_ID,
  onNoticesUpdated: (notices: Notice[]) => void
): () => void {
  const safeHostelId = hostelId && hostelId.trim() !== '' ? hostelId : DEFAULT_HOSTEL_ID;
  if (!safeHostelId) {
    onNoticesUpdated([]);
    return () => {};
  }
  const noticesCollection = collection(db, 'hostels', safeHostelId, 'notices');

  return onSnapshot(
    noticesCollection,
    (snapshot) => {
      const list: Notice[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Notice;
        list.push({
          ...data,
          id: docSnap.id || data.id
        });
      });

      // Sort: Pinned first, then Emergency first, then by CreatedAt Descending
      list.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

        const priorityScore = { emergency: 3, important: 2, normal: 1 };
        const scoreA = priorityScore[a.priority] || 1;
        const scoreB = priorityScore[b.priority] || 1;
        if (scoreA !== scoreB) return scoreB - scoreA;

        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });

      onNoticesUpdated(list);
    },
    (error) => {
      console.error('Error listening to hostel notices:', error);
      handleFirestoreError(error, OperationType.GET, `hostels/${hostelId}/notices`);
    }
  );
}

// Publish Notice to Firestore & Push Notification
export async function publishNotice(
  noticeData: Omit<Notice, 'id' | 'createdAt' | 'deliveryStatus'>,
  hostelId: string = DEFAULT_HOSTEL_ID
): Promise<Notice> {
  const noticeId = `noti_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const createdAt = new Date().toISOString();

  const newNotice: Notice = {
    ...noticeData,
    id: noticeId,
    hostelId: hostelId,
    createdAt: createdAt,
    isPinned: noticeData.isPinned || false,
    deliveryStatus: 'delivered',
    readBy: []
  };

  try {
    // 1. Save to hostels/{hostelId}/notices/{noticeId}
    const noticeRef = doc(db, 'hostels', hostelId, 'notices', noticeId);
    await setDoc(noticeRef, newNotice);

    // 2. Also write to top-level notifications collection for legacy notification subscribers
    const topNotifRef = doc(db, 'notifications', noticeId);
    await setDoc(topNotifRef, {
      id: noticeId,
      noticeId: noticeId,
      hostelId: hostelId,
      title: newNotice.title,
      message: newNotice.description,
      description: newNotice.description,
      type: newNotice.priority === 'emergency' ? 'emergency' : 'announcement',
      priority: newNotice.priority,
      category: newNotice.priority === 'emergency' ? '🔴 Emergency' : (newNotice.priority === 'important' ? '🟠 Important' : '🔵 General'),
      target: newNotice.audienceType === 'all' ? 'all' : (newNotice.audienceValue || 'all'),
      targetAudience: `${newNotice.audienceType.toUpperCase()}: ${newNotice.audienceValue || 'All'}`,
      attachmentURL: newNotice.attachmentURL || null,
      attachmentName: newNotice.attachmentName || null,
      attachmentType: newNotice.attachmentType || null,
      createdAt: createdAt,
      expiresAt: newNotice.expiresAt || null,
      sender: newNotice.createdBy
    });

    // 3. Trigger Local Browser / Service Worker Push Alert
    const audienceTag = newNotice.audienceType === 'all' ? 'All Students' : `${newNotice.audienceType}: ${newNotice.audienceValue}`;
    sendLocalPushNotification(
      `📢 [${newNotice.priority.toUpperCase()}] ${newNotice.title}`,
      `${newNotice.description.slice(0, 120)}... (${audienceTag})`,
      newNotice.priority,
      noticeId
    );

    return newNotice;
  } catch (err) {
    console.error('Error publishing notice:', err);
    handleFirestoreError(err, OperationType.WRITE, `hostels/${hostelId}/notices/${noticeId}`);
    throw err;
  }
}

// Update Notice
export async function updateNotice(
  hostelId: string,
  noticeId: string,
  updates: Partial<Notice>
): Promise<void> {
  try {
    const noticeRef = doc(db, 'hostels', hostelId, 'notices', noticeId);
    await updateDoc(noticeRef, updates);

    // Also update top notification doc if exists
    try {
      const topRef = doc(db, 'notifications', noticeId);
      await updateDoc(topRef, {
        title: updates.title,
        message: updates.description,
        description: updates.description,
        priority: updates.priority,
        expiresAt: updates.expiresAt,
        attachmentURL: updates.attachmentURL,
        attachmentName: updates.attachmentName
      });
    } catch (e) {
      // Ignore if top notification doc is missing
    }
  } catch (err) {
    console.error('Error updating notice:', err);
    handleFirestoreError(err, OperationType.UPDATE, `hostels/${hostelId}/notices/${noticeId}`);
    throw err;
  }
}

// Delete Notice
export async function deleteNotice(hostelId: string, noticeId: string): Promise<void> {
  try {
    const noticeRef = doc(db, 'hostels', hostelId, 'notices', noticeId);
    await deleteDoc(noticeRef);

    try {
      const topRef = doc(db, 'notifications', noticeId);
      await deleteDoc(topRef);
    } catch (e) {
      // Ignore
    }
  } catch (err) {
    console.error('Error deleting notice:', err);
    handleFirestoreError(err, OperationType.DELETE, `hostels/${hostelId}/notices/${noticeId}`);
    throw err;
  }
}

// Toggle Pin Notice
export async function togglePinNotice(
  hostelId: string,
  noticeId: string,
  currentPinnedState: boolean
): Promise<void> {
  await updateNotice(hostelId, noticeId, { isPinned: !currentPinnedState });
}

// Mark Notice as Read by Student
export async function markNoticeAsRead(
  hostelId: string,
  noticeId: string,
  studentId: string,
  currentReadBy: string[] = []
): Promise<void> {
  if (currentReadBy.includes(studentId)) return;
  const updatedReadBy = [...currentReadBy, studentId];
  await updateNotice(hostelId, noticeId, { readBy: updatedReadBy });
}

// Filter Notices for a Specific Student Profile
export function filterNoticesForStudent(notices: Notice[], student: Student): Notice[] {
  if (!student) return notices;

  const now = new Date();

  return notices.filter((notice) => {
    // Check expiration date
    if (notice.expiresAt) {
      const expDate = new Date(notice.expiresAt);
      if (expDate < now) return false;
    }

    // Match Audience Type
    if (notice.audienceType === 'all') return true;

    if (notice.audienceType === 'department') {
      return (
        student.department &&
        student.department.trim().toLowerCase() === (notice.audienceValue || '').trim().toLowerCase()
      );
    }

    if (notice.audienceType === 'semester') {
      return (
        student.semester &&
        student.semester.trim().toLowerCase() === (notice.audienceValue || '').trim().toLowerCase()
      );
    }

    if (notice.audienceType === 'room') {
      return (
        student.roomNumber &&
        student.roomNumber.trim().toLowerCase() === (notice.audienceValue || '').trim().toLowerCase()
      );
    }

    if (notice.audienceType === 'individual') {
      return (
        (student.rollNumber && student.rollNumber.trim().toLowerCase() === (notice.audienceValue || '').trim().toLowerCase()) ||
        (student.id && student.id.trim().toLowerCase() === (notice.audienceValue || '').trim().toLowerCase())
      );
    }

    return true;
  });
}
