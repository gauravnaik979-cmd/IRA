import { 
  db, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  createBatch, 
  retryOperation 
} from './firestoreService';
import { Room, Hostel } from '../types';

/**
 * Initializes hostels and rooms if they do not exist in Firestore.
 */
export async function initializeRoomsAndHostelsIfMissing(): Promise<void> {
  const hostelsSnap = await retryOperation(() => getDocs(collection(db, 'hostels')));
  const roomsSnap = await retryOperation(() => getDocs(collection(db, 'rooms')));
  
  const batch = createBatch();
  let needsCommit = false;

  // 1. Initialize Hostels if missing
  if (hostelsSnap.empty) {
    const defaultHostels: Hostel[] = [
      { id: 'gangpur-boys-hostel', name: "Gangpur Boys' Hostel", type: 'Boys', totalRooms: 10, capacity: 30 }
    ];
    for (const h of defaultHostels) {
      const hRef = doc(db, 'hostels', h.id);
      batch.set(hRef, h);
    }
    needsCommit = true;
  }

  // 2. Initialize Rooms if missing for Gangpur Boys' Hostel
  if (roomsSnap.empty) {
    for (let i = 1; i <= 10; i++) {
      const roomNum = `10${i}`;
      const roomId = `r_gangpur_${roomNum}`;
      const roomDoc = {
        id: roomId,
        hostelId: 'gangpur-boys-hostel',
        hostelName: "Gangpur Boys' Hostel",
        roomNumber: roomNum,
        floor: 1,
        capacity: 3,
        occupiedBeds: 0,
        availableBeds: 3,
        students: [],
        createdAt: new Date().toISOString()
      };
      batch.set(doc(db, 'rooms', roomId), roomDoc);
    }
    needsCommit = true;
  }

  if (needsCommit) {
    await retryOperation(() => batch.commit());
    console.log('Hostels and Rooms successfully initialized in Firestore.');
  }
}

/**
 * Transaction-safe room allocation.
 */
export async function updateRoomOccupancy(
  hostelName: string,
  roomNumber: string,
  studentId: string,
  action: 'add' | 'remove'
): Promise<void> {
  const roomsRef = collection(db, 'rooms');
  const q = query(roomsRef, where('hostelName', '==', hostelName), where('roomNumber', '==', roomNumber));
  const roomsSnap = await retryOperation(() => getDocs(q));
  
  if (roomsSnap.empty) {
    console.warn(`No room document found matching Hostel: ${hostelName}, Room: ${roomNumber}`);
    return;
  }

  const roomDocRef = doc(db, 'rooms', roomsSnap.docs[0].id);
  const roomData = roomsSnap.docs[0].data() as Room;

  let studentsList = roomData.students || [];
  if (action === 'add') {
    if (!studentsList.includes(studentId)) {
      studentsList.push(studentId);
    }
  } else {
    studentsList = studentsList.filter(id => id !== studentId);
  }

  const occupiedBeds = studentsList.length;
  const availableBeds = Math.max(0, (roomData.capacity || 3) - occupiedBeds);

  await retryOperation(() => updateDoc(roomDocRef, {
    students: studentsList,
    occupiedBeds,
    availableBeds
  }));
}
