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
import { DatabaseOverviewStats, SystemBackupRecord, Hostel, Student, Attendance, LeaveRequest, MonthlyBill } from '../types';
import { logTransaction } from './hostelService';

/**
 * Downloads a string or blob directly to the user's browser
 */
function triggerFileDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Converts array of JSON objects into formatted CSV
 */
export function formatToCSV(data: any[], headers: { key: string; label: string }[]): string {
  if (!data || data.length === 0) {
    return headers.map(h => `"${h.label}"`).join(',') + '\n';
  }

  const headerRow = headers.map(h => `"${h.label.replace(/"/g, '""')}"`).join(',');
  const rows = data.map(item => {
    return headers.map(h => {
      let val = item[h.key];
      if (val === undefined || val === null) {
        val = '';
      } else if (typeof val === 'object') {
        val = JSON.stringify(val);
      } else {
        val = String(val);
      }
      return `"${val.replace(/"/g, '""')}"`;
    }).join(',');
  });

  return [headerRow, ...rows].join('\n');
}

/**
 * Calculates live database overview counts from real Firestore collections
 */
export async function fetchDatabaseOverview(): Promise<DatabaseOverviewStats> {
  try {
    // 1. Hostels
    const hostelsSnap = await retryOperation(() => getDocs(collection(db, 'hostels')));
    const totalHostels = hostelsSnap.size;
    let computedRooms = 0;
    let computedBeds = 0;

    hostelsSnap.forEach(d => {
      const h = d.data();
      computedRooms += Number(h.totalRooms || 0);
      computedBeds += Number(h.capacity || 0);
    });

    // 2. Students
    const studentsSnap = await retryOperation(() => getDocs(collection(db, 'students')));
    const totalStudents = studentsSnap.size;

    // 3. Dedicated Rooms collection (if initialized)
    const roomsSnap = await retryOperation(() => getDocs(collection(db, 'rooms')));
    const totalRooms = Math.max(roomsSnap.size, computedRooms);
    const totalBeds = Math.max(computedBeds, totalRooms * 4);

    // 4. Attendance
    const attendanceSnap = await retryOperation(() => getDocs(collection(db, 'attendance')));
    let totalAttendanceRecords = attendanceSnap.size;

    // 5. Leaves
    const leavesSnap = await retryOperation(() => getDocs(collection(db, 'leaves')));
    const leaveReqSnap = await retryOperation(() => getDocs(collection(db, 'leave_requests')));
    const totalLeaveRecords = leavesSnap.size + leaveReqSnap.size;

    // 6. Mess / Monthly Bills
    const billsSnap = await retryOperation(() => getDocs(collection(db, 'monthlyBills')));
    const mealAttSnap = await retryOperation(() => getDocs(collection(db, 'meal_attendance')));
    const totalBillingRecords = billsSnap.size + mealAttSnap.size;

    // 7. System Logs
    const logsSnap = await retryOperation(() => getDocs(collection(db, 'audit_logs')));
    const totalSystemLogs = logsSnap.size;

    return {
      totalHostels,
      totalStudents,
      totalRooms,
      totalBeds,
      totalAttendanceRecords,
      totalLeaveRecords,
      totalBillingRecords,
      totalSystemLogs,
      lastCalculatedAt: new Date().toISOString()
    };
  } catch (err) {
    console.error('Error calculating database overview:', err);
    throw err;
  }
}

/**
 * EXPORT 1: Student Records (CSV)
 */
export async function exportStudentRecords(adminIdentifier: string): Promise<number> {
  const snap = await retryOperation(() => getDocs(collection(db, 'students')));
  const records: any[] = [];
  snap.forEach(d => records.push({ id: d.id, ...d.data() }));

  const headers = [
    { key: 'id', label: 'Student ID' },
    { key: 'rollNumber', label: 'Roll Number' },
    { key: 'name', label: 'Student Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'department', label: 'Department' },
    { key: 'semester', label: 'Semester' },
    { key: 'hostelName', label: 'Hostel' },
    { key: 'roomNumber', label: 'Room' },
    { key: 'bedNumber', label: 'Bed' },
    { key: 'guardianName', label: 'Guardian Name' },
    { key: 'guardianPhone', label: 'Guardian Phone' },
    { key: 'hostelStatus', label: 'Hostel Status' },
    { key: 'messStatus', label: 'Mess Status' },
    { key: 'admissionDate', label: 'Admission Date' }
  ];

  const csv = formatToCSV(records, headers);
  const filename = `ira-hostel-students-${new Date().toISOString().split('T')[0]}.csv`;
  triggerFileDownload(filename, csv, 'text/csv;charset=utf-8;');

  await logTransaction(
    'global',
    adminIdentifier,
    'super_admin',
    'DATA_EXPORTED',
    `Exported Student Records (${records.length} records) as CSV.`
  );

  return records.length;
}

/**
 * EXPORT 2: Attendance Records (CSV)
 */
export async function exportAttendanceRecords(adminIdentifier: string): Promise<number> {
  const snap = await retryOperation(() => getDocs(collection(db, 'attendance')));
  const records: any[] = [];
  snap.forEach(d => records.push({ id: d.id, ...d.data() }));

  const headers = [
    { key: 'id', label: 'Record ID' },
    { key: 'date', label: 'Date' },
    { key: 'time', label: 'Time' },
    { key: 'studentName', label: 'Student Name' },
    { key: 'rollNumber', label: 'Roll Number' },
    { key: 'hostelName', label: 'Hostel' },
    { key: 'roomNumber', label: 'Room' },
    { key: 'type', label: 'Meal/Scan Type' },
    { key: 'status', label: 'Status' },
    { key: 'recordedBy', label: 'Recorded By' }
  ];

  const csv = formatToCSV(records, headers);
  const filename = `ira-hostel-attendance-${new Date().toISOString().split('T')[0]}.csv`;
  triggerFileDownload(filename, csv, 'text/csv;charset=utf-8;');

  await logTransaction(
    'global',
    adminIdentifier,
    'super_admin',
    'DATA_EXPORTED',
    `Exported Attendance Records (${records.length} records) as CSV.`
  );

  return records.length;
}

/**
 * EXPORT 3: Mess & Billing Records (CSV)
 */
export async function exportMessBillingRecords(adminIdentifier: string): Promise<number> {
  const snap = await retryOperation(() => getDocs(collection(db, 'monthlyBills')));
  const records: any[] = [];
  snap.forEach(d => records.push({ id: d.id, ...d.data() }));

  const headers = [
    { key: 'id', label: 'Bill ID' },
    { key: 'studentName', label: 'Student Name' },
    { key: 'rollNumber', label: 'Roll Number' },
    { key: 'month', label: 'Month' },
    { key: 'year', label: 'Year' },
    { key: 'lunchCount', label: 'Lunch Count' },
    { key: 'dinnerCount', label: 'Dinner Count' },
    { key: 'totalMeals', label: 'Total Meals' },
    { key: 'leaveDays', label: 'Leave Days' },
    { key: 'totalAmount', label: 'Total Amount (₹)' },
    { key: 'status', label: 'Payment Status' },
    { key: 'updatedAt', label: 'Last Updated' }
  ];

  const csv = formatToCSV(records, headers);
  const filename = `ira-hostel-mess-billing-${new Date().toISOString().split('T')[0]}.csv`;
  triggerFileDownload(filename, csv, 'text/csv;charset=utf-8;');

  await logTransaction(
    'global',
    adminIdentifier,
    'super_admin',
    'DATA_EXPORTED',
    `Exported Mess & Billing Records (${records.length} records) as CSV.`
  );

  return records.length;
}

/**
 * EXPORT 4: Leave Records (CSV)
 */
export async function exportLeaveRecords(adminIdentifier: string): Promise<number> {
  const leavesSnap = await retryOperation(() => getDocs(collection(db, 'leaves')));
  const reqSnap = await retryOperation(() => getDocs(collection(db, 'leave_requests')));
  
  const records: any[] = [];
  leavesSnap.forEach(d => records.push({ id: d.id, ...d.data() }));
  reqSnap.forEach(d => {
    if (!records.some(r => r.id === d.id)) {
      records.push({ id: d.id, ...d.data() });
    }
  });

  const headers = [
    { key: 'id', label: 'Leave ID' },
    { key: 'studentName', label: 'Student Name' },
    { key: 'rollNumber', label: 'Roll Number' },
    { key: 'department', label: 'Department' },
    { key: 'hostelName', label: 'Hostel' },
    { key: 'roomNumber', label: 'Room' },
    { key: 'startDate', label: 'Start Date' },
    { key: 'endDate', label: 'End Date' },
    { key: 'reason', label: 'Reason' },
    { key: 'status', label: 'Status' },
    { key: 'createdAt', label: 'Applied At' },
    { key: 'processedBy', label: 'Approved/Rejected By' }
  ];

  const csv = formatToCSV(records, headers);
  const filename = `ira-hostel-leave-records-${new Date().toISOString().split('T')[0]}.csv`;
  triggerFileDownload(filename, csv, 'text/csv;charset=utf-8;');

  await logTransaction(
    'global',
    adminIdentifier,
    'super_admin',
    'DATA_EXPORTED',
    `Exported Leave Records (${records.length} records) as CSV.`
  );

  return records.length;
}

/**
 * EXPORT 5: Hostel Data (CSV)
 */
export async function exportHostelData(adminIdentifier: string): Promise<number> {
  const snap = await retryOperation(() => getDocs(collection(db, 'hostels')));
  const records: any[] = [];
  snap.forEach(d => records.push({ id: d.id, ...d.data() }));

  const headers = [
    { key: 'id', label: 'Hostel ID' },
    { key: 'name', label: 'Hostel Name' },
    { key: 'code', label: 'Hostel Code' },
    { key: 'district', label: 'District' },
    { key: 'type', label: 'Type' },
    { key: 'totalRooms', label: 'Total Rooms' },
    { key: 'bedsPerRoom', label: 'Beds per Room' },
    { key: 'capacity', label: 'Capacity' },
    { key: 'superintendentName', label: 'In-charge Name' },
    { key: 'superintendentEmail', label: 'In-charge Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'status', label: 'Status' },
    { key: 'createdAt', label: 'Created At' }
  ];

  const csv = formatToCSV(records, headers);
  const filename = `ira-hostel-directory-${new Date().toISOString().split('T')[0]}.csv`;
  triggerFileDownload(filename, csv, 'text/csv;charset=utf-8;');

  await logTransaction(
    'global',
    adminIdentifier,
    'super_admin',
    'DATA_EXPORTED',
    `Exported Hostel Directory (${records.length} records) as CSV.`
  );

  return records.length;
}

/**
 * EXPORT 6: System Audit Logs (CSV)
 */
export async function exportSystemLogs(adminIdentifier: string): Promise<number> {
  const snap = await retryOperation(() => getDocs(collection(db, 'audit_logs')));
  const records: any[] = [];
  snap.forEach(d => records.push({ id: d.id, ...d.data() }));

  const headers = [
    { key: 'id', label: 'Log ID' },
    { key: 'timestamp', label: 'Timestamp' },
    { key: 'action', label: 'Action' },
    { key: 'hostelId', label: 'Hostel ID' },
    { key: 'userId', label: 'User ID' },
    { key: 'role', label: 'Role' },
    { key: 'details', label: 'Details' }
  ];

  const csv = formatToCSV(records, headers);
  const filename = `ira-hostel-system-logs-${new Date().toISOString().split('T')[0]}.csv`;
  triggerFileDownload(filename, csv, 'text/csv;charset=utf-8;');

  await logTransaction(
    'global',
    adminIdentifier,
    'super_admin',
    'DATA_EXPORTED',
    `Exported System Audit Logs (${records.length} records) as CSV.`
  );

  return records.length;
}

/**
 * EXPORT 7: Complete System Export (JSON)
 */
export async function exportCompleteSystem(adminIdentifier: string): Promise<number> {
  const collectionsToFetch = ['hostels', 'students', 'users', 'rooms', 'attendance', 'leaves', 'monthlyBills', 'notices', 'audit_logs'];
  const systemExport: Record<string, any[]> = {};
  let totalCount = 0;

  for (const col of collectionsToFetch) {
    try {
      const snap = await retryOperation(() => getDocs(collection(db, col)));
      const items: any[] = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      systemExport[col] = items;
      totalCount += items.length;
    } catch (e) {
      console.warn(`Export note for ${col}:`, e);
      systemExport[col] = [];
    }
  }

  const exportPayload = {
    platform: 'IRA HOSTEL Central Administration',
    exportType: 'COMPLETE_SYSTEM_EXPORT',
    version: '2.4.0',
    timestamp: new Date().toISOString(),
    exportedBy: adminIdentifier,
    totalRecords: totalCount,
    collections: systemExport
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const filename = `ira-hostel-complete-system-export-${new Date().toISOString().split('T')[0]}.json`;
  triggerFileDownload(filename, jsonStr, 'application/json');

  await logTransaction(
    'global',
    adminIdentifier,
    'super_admin',
    'DATA_EXPORTED',
    `Generated Complete System Export JSON (${totalCount} total records across ${collectionsToFetch.length} collections).`
  );

  return totalCount;
}

/**
 * Creates a real, structured system backup snapshot and saves metadata in Firestore
 */
export async function createSystemBackup(
  adminIdentifier: string,
  onProgress?: (step: string, percent: number) => void
): Promise<SystemBackupRecord> {
  const update = (step: string, percent: number) => {
    if (onProgress) onProgress(step, percent);
  };

  update('Initializing snapshot engine...', 10);

  const snapshot: Record<string, any[]> = {};
  const collectionCounts: Record<string, number> = {};
  let totalRecords = 0;

  // 1. Hostels
  update('Backing up institutional hostels and configurations...', 25);
  const hostelsSnap = await retryOperation(() => getDocs(collection(db, 'hostels')));
  const hostels: any[] = [];
  hostelsSnap.forEach(d => hostels.push({ id: d.id, ...d.data() }));
  snapshot['hostels'] = hostels;
  collectionCounts['hostels'] = hostels.length;
  totalRecords += hostels.length;

  // 2. Students & Users
  update('Backing up student directories and user accounts...', 40);
  const studentsSnap = await retryOperation(() => getDocs(collection(db, 'students')));
  const students: any[] = [];
  studentsSnap.forEach(d => students.push({ id: d.id, ...d.data() }));
  snapshot['students'] = students;
  collectionCounts['students'] = students.length;
  totalRecords += students.length;

  const usersSnap = await retryOperation(() => getDocs(collection(db, 'users')));
  const users: any[] = [];
  usersSnap.forEach(d => users.push({ id: d.id, ...d.data() }));
  snapshot['users'] = users;
  collectionCounts['users'] = users.length;
  totalRecords += users.length;

  // 3. Rooms
  update('Backing up room inventories and allocations...', 55);
  const roomsSnap = await retryOperation(() => getDocs(collection(db, 'rooms')));
  const rooms: any[] = [];
  roomsSnap.forEach(d => rooms.push({ id: d.id, ...d.data() }));
  snapshot['rooms'] = rooms;
  collectionCounts['rooms'] = rooms.length;
  totalRecords += rooms.length;

  // 4. Attendance & Leaves
  update('Backing up gate attendance and leave requests...', 70);
  const attSnap = await retryOperation(() => getDocs(collection(db, 'attendance')));
  const attendance: any[] = [];
  attSnap.forEach(d => attendance.push({ id: d.id, ...d.data() }));
  snapshot['attendance'] = attendance;
  collectionCounts['attendance'] = attendance.length;
  totalRecords += attendance.length;

  const leavesSnap = await retryOperation(() => getDocs(collection(db, 'leaves')));
  const leaves: any[] = [];
  leavesSnap.forEach(d => leaves.push({ id: d.id, ...d.data() }));
  snapshot['leaves'] = leaves;
  collectionCounts['leaves'] = leaves.length;
  totalRecords += leaves.length;

  // 5. Billing & Logs
  update('Backing up mess ledgers and system audit logs...', 85);
  const billsSnap = await retryOperation(() => getDocs(collection(db, 'monthlyBills')));
  const monthlyBills: any[] = [];
  billsSnap.forEach(d => monthlyBills.push({ id: d.id, ...d.data() }));
  snapshot['monthlyBills'] = monthlyBills;
  collectionCounts['monthlyBills'] = monthlyBills.length;
  totalRecords += monthlyBills.length;

  const logsSnap = await retryOperation(() => getDocs(collection(db, 'audit_logs')));
  const logs: any[] = [];
  logsSnap.forEach(d => logs.push({ id: d.id, ...d.data() }));
  snapshot['audit_logs'] = logs;
  collectionCounts['audit_logs'] = logs.length;
  totalRecords += logs.length;

  // 6. Generate Backup Package
  update('Generating verified snapshot package...', 95);
  const timestamp = new Date().toISOString();
  const dateSlug = timestamp.split('T')[0].replace(/-/g, '');
  const randSlug = Math.floor(1000 + Math.random() * 9000);
  const backupId = `BKP-${dateSlug}-${randSlug}`;

  const fullPayload = {
    backupId,
    timestamp,
    createdBy: adminIdentifier,
    scope: 'Full System (Hostels, Students, Users, Rooms, Attendance, Mess, Leaves, Logs)',
    recordCount: totalRecords,
    collectionsSummary: collectionCounts,
    data: snapshot
  };

  const payloadString = JSON.stringify(fullPayload, null, 2);
  const sizeBytes = new Blob([payloadString]).size;
  const sizeFormatted = sizeBytes > 1024 * 1024
    ? `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
    : `${(sizeBytes / 1024).toFixed(1)} KB`;

  const backupRecord: SystemBackupRecord = {
    id: backupId,
    timestamp,
    createdAt: timestamp,
    createdBy: adminIdentifier,
    scope: 'Full System (Hostels, Students, Users, Rooms, Attendance, Mess, Leaves, Logs)',
    recordCount: totalRecords,
    sizeBytes,
    sizeFormatted,
    status: 'Completed',
    collectionsSummary: collectionCounts,
    payload: fullPayload
  };

  // Store in system_backups Firestore collection
  await retryOperation(() => setDoc(doc(db, 'system_backups', backupId), backupRecord));

  // Trigger automatic download of JSON file
  triggerFileDownload(`ira-hostel-backup-${backupId}.json`, payloadString, 'application/json');

  // Log in system logs
  await logTransaction(
    'global',
    adminIdentifier,
    'super_admin',
    'BACKUP_CREATED',
    `Created System Backup ${backupId} (${totalRecords} records, ${sizeFormatted}).`
  );

  update('Backup successfully completed and downloaded!', 100);

  return backupRecord;
}

/**
 * Retrieves all previous system backups from Firestore
 */
export async function getBackupHistory(): Promise<SystemBackupRecord[]> {
  try {
    const snap = await retryOperation(() => getDocs(collection(db, 'system_backups')));
    const backups: SystemBackupRecord[] = [];
    snap.forEach(d => {
      backups.push({ id: d.id, ...d.data() } as SystemBackupRecord);
    });

    return backups.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  } catch (err) {
    console.error('Error fetching backup history:', err);
    return [];
  }
}

/**
 * Downloads a backup from history
 */
export function downloadBackupFromHistory(backup: SystemBackupRecord): void {
  const content = backup.payload 
    ? JSON.stringify(backup.payload, null, 2)
    : JSON.stringify(backup, null, 2);
  triggerFileDownload(`ira-hostel-backup-${backup.id}.json`, content, 'application/json');
}

/**
 * Restores system data from a verified backup JSON payload
 */
export async function restoreSystemBackup(
  backupPayload: any,
  adminIdentifier: string,
  onProgress?: (step: string, percent: number) => void
): Promise<{ restoredRecords: number; collectionsRestored: string[] }> {
  const update = (step: string, percent: number) => {
    if (onProgress) onProgress(step, percent);
  };

  update('Validating backup integrity and structure...', 10);

  const data = backupPayload.data || backupPayload.collections;
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid backup file format. Expected a valid IRA HOSTEL backup JSON structure with data collections.');
  }

  let totalRestored = 0;
  const collectionsRestored: string[] = [];

  const collections = Object.keys(data);
  const totalCollections = collections.length;

  for (let i = 0; i < totalCollections; i++) {
    const colName = collections[i];
    const items = data[colName];

    if (Array.isArray(items) && items.length > 0) {
      const currentPercent = 15 + Math.round(((i + 1) / totalCollections) * 75);
      update(`Restoring collection "${colName}" (${items.length} records)...`, currentPercent);

      for (const item of items) {
        if (item.id) {
          const docRef = doc(db, colName, item.id);
          await retryOperation(() => setDoc(docRef, item, { merge: true }));
          totalRestored++;
        }
      }
      collectionsRestored.push(colName);
    }
  }

  update('Finalizing system restore and registering audit log...', 95);

  const backupId = backupPayload.backupId || backupPayload.id || 'Custom Upload';
  await logTransaction(
    'global',
    adminIdentifier,
    'super_admin',
    'BACKUP_RESTORED',
    `Restored system state from backup ${backupId} (${totalRestored} documents restored across ${collectionsRestored.join(', ')}).`
  );

  update('Restoration completed successfully!', 100);

  return { restoredRecords: totalRestored, collectionsRestored };
}
