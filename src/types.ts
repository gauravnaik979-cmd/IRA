export interface Student {
  id: string;
  uid?: string;
  email?: string;
  rollNumber: string;
  name: string;
  photoUrl?: string;
  photoURL?: string;
  department: string;
  semester: string;
  phone: string;
  studentPhone?: string;
  guardianName?: string;
  guardianPhone: string;
  hostelId?: string;
  hostelName: string;
  roomNumber: string;
  bedNumber: string;
  qrId: string;
  messStatus: 'active' | 'inactive';
  hostelStatus: 'present' | 'absent' | 'leave';
  leaveStatus: 'none' | 'pending' | 'approved' | 'rejected';
  admissionDate: string;
  temporaryPassword?: string;
  mustChangePassword?: boolean;
}

export interface Attendance {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  hostelId?: string;
  hostelName: string;
  roomNumber: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  type: 'hostel' | 'lunch' | 'dinner';
  status: 'present' | 'absent' | 'leave';
  recordedBy: 'scanner' | 'manual';
  notes?: string;
  correctedBy?: string;
  correctionReason?: string;
  updatedAt?: string;
}

export interface LeaveRequest {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  department: string;
  hostelName: string;
  roomNumber: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
}

export interface Room {
  id: string;
  hostelId?: string;
  hostelName: string;
  roomNumber: string;
  capacity: number;
  occupiedBeds: number;
  students: string[]; // student ids
}

export interface Hostel {
  id: string;
  name: string;
  code?: string;
  type?: 'Boys' | 'Girls';
  college?: string;
  district?: string;
  state?: string;
  address?: string;
  phone?: string;
  email?: string;
  buildings?: number;
  status?: 'active' | 'suspended' | 'inactive';
  isActive?: boolean;
  messStatus?: 'OPEN' | 'CLOSED' | 'active' | 'suspended';
  messEnabled?: boolean;
  lunchEnabled?: boolean;
  dinnerEnabled?: boolean;
  qrEnabled?: boolean;
  qrGateAttendanceEnabled?: boolean;
  gateMovementTrackingEnabled?: boolean;
  totalRooms?: number;
  bedsPerRoom?: number;
  capacity?: number;
  studentCount?: number;
  superintendentId?: string;
  superintendentName?: string;
  superintendentEmail?: string;
  superintendentPhone?: string;
  superIntendentName?: string;
  superIntendentEmail?: string;
  mealRates?: {
    lunchPrice: number;
    dinnerPrice: number;
  };
  createdAt?: any;
  updatedAt?: any;
}

export interface MealRates {
  lunchPrice: number;
  dinnerPrice: number;
}

export interface MonthlyBill {
  id: string; // studentId_YYYY_MM
  studentId: string;
  studentName: string;
  rollNumber: string;
  department: string;
  roomNumber: string;
  hostelId?: string;
  hostelName?: string;
  month: string; // YYYY-MM
  year?: string;
  lunchCount: number;
  dinnerCount: number;
  totalMeals?: number;
  leaveDays: number;
  totalAmount: number;
  status: 'unpaid' | 'paid';
  updatedAt: string;
}

export interface Notice {
  id: string;
  hostelId: string;
  title: string;
  description: string;
  priority: 'normal' | 'important' | 'emergency';
  audienceType: 'all' | 'department' | 'semester' | 'room' | 'individual';
  audienceValue: string; // e.g. 'Computer Science', 'Semester 4', '102', 'OD-2024-001'
  attachmentURL?: string | null;
  attachmentName?: string | null;
  attachmentType?: 'image' | 'pdf' | null;
  createdBy: string;
  createdAt: string; // ISO string
  expiresAt?: string | null; // ISO string or null
  isPinned?: boolean;
  deliveryStatus?: 'sent' | 'delivered';
  readBy?: string[]; // studentIds who marked as read
}

export interface Notification {
  id: string;
  noticeId?: string;
  hostelId?: string;
  title: string;
  message: string;
  description?: string;
  type: 'announcement' | 'leave_status' | 'mess_toggle' | 'emergency';
  priority?: 'normal' | 'important' | 'emergency';
  category?: '🔴 Emergency' | '🟠 Important' | '🔵 General' | '🟢 Personal';
  target: 'all' | string; // 'all' or studentId or rollNumber
  targetAudience?: string;
  attachmentURL?: string | null;
  attachmentName?: string | null;
  attachmentType?: 'image' | 'pdf' | null;
  createdAt: string;
  expiresAt?: string | null;
  isRead?: boolean;
  sender: string;
}

export interface AuditLog {
  id: string;
  superintendentId: string;
  hostelId: string;
  studentId: string;
  attendanceId: string;
  reason: string;
  timestamp: string;
}

export interface MealSession {
  id: string;
  currentMeal: 'Lunch' | 'Dinner';
  status: 'OPEN' | 'CLOSED' | 'NOT_STARTED';
  openedAt: string | null;
  closedAt: string | null;
  openedBy: string;
  closedBy?: string;
  date?: string;
}

export interface DailyMealReport {
  id: string;
  date: string;
  meal: 'Lunch' | 'Dinner';
  hostelId: string;
  openedAt: string;
  closedAt: string;
  openedBy: string;
  closedBy: string;
  lunchCount: number;
  dinnerCount: number;
  totalMeals: number;
  pendingStudents: number;
  totalRevenue: number;
  averageScanTime?: string;
  reportGeneratedAt: string;
  status: 'FINALIZED';
}

export interface SystemBackupRecord {
  id: string;
  timestamp: string;
  createdAt: string;
  createdBy: string;
  scope: string;
  recordCount: number;
  sizeBytes?: number;
  sizeFormatted: string;
  status: 'Completed' | 'Failed' | 'Restored';
  collectionsSummary?: Record<string, number>;
  payload?: any;
}

export interface DatabaseOverviewStats {
  totalHostels: number;
  totalStudents: number;
  totalRooms: number;
  totalBeds: number;
  totalAttendanceRecords: number;
  totalLeaveRecords: number;
  totalBillingRecords: number;
  totalSystemLogs: number;
  lastCalculatedAt: string;
}
