import { 
  db, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot 
} from './firestoreService';
import { MealSession, DailyMealReport } from '../types';

/**
 * Subscribes to real-time updates for the current meal session.
 */
export function subscribeToMealSession(callback: (session: MealSession) => void) {
  const sessionRef = doc(db, 'mealSessions', 'current');
  const defaultSession: MealSession = {
    id: 'current',
    currentMeal: 'Lunch',
    status: 'NOT_STARTED',
    openedAt: null,
    closedAt: null,
    openedBy: 'Hostel Superintendent',
    date: new Date().toISOString().split('T')[0]
  };

  return onSnapshot(
    sessionRef, 
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as MealSession);
      } else {
        callback(defaultSession);
      }
    },
    (err) => {
      console.warn('Meal session snapshot listener notice:', err);
      callback(defaultSession);
    }
  );
}

/**
 * Opens a meal session in Firestore.
 */
export async function openMealSession(
  meal: 'Lunch' | 'Dinner', 
  operatorName: string = 'Hostel Superintendent'
): Promise<void> {
  const todayStr = new Date().toISOString().split('T')[0];
  const sessionRef = doc(db, 'mealSessions', 'current');

  const newSession: MealSession = {
    id: 'current',
    currentMeal: meal,
    status: 'OPEN',
    openedAt: new Date().toISOString(),
    closedAt: null,
    openedBy: operatorName,
    date: todayStr
  };

  await setDoc(sessionRef, newSession);

  // Log to transactionLogs
  const logId = `tx_log_open_${Date.now()}`;
  await setDoc(doc(db, 'transactionLogs', logId), {
    id: logId,
    action: 'Session Opened',
    mealType: meal,
    operatorName: operatorName,
    timestamp: new Date().toISOString()
  });
}

/**
 * Closes a meal session, generates auto dailyMealReport, and logs to transactionLogs.
 */
export async function closeMealSession(
  meal: 'Lunch' | 'Dinner',
  operatorName: string = 'Hostel Superintendent',
  stats: {
    lunchCount: number;
    dinnerCount: number;
    pendingStudents: number;
    totalRevenue: number;
    hostelId?: string;
  }
): Promise<DailyMealReport> {
  const todayStr = new Date().toISOString().split('T')[0];
  const sessionRef = doc(db, 'mealSessions', 'current');

  // Fetch current session for openedAt and openedBy info
  const sessionSnap = await getDoc(sessionRef);
  const currentSessionData = sessionSnap.exists() ? sessionSnap.data() as MealSession : null;

  const nowIso = new Date().toISOString();

  // 1. Update mealSessions/current
  await updateDoc(sessionRef, {
    status: 'CLOSED',
    closedAt: nowIso,
    closedBy: operatorName
  });

  // 2. Automatically create dailyMealReports/{date}_{meal}
  const reportId = `${todayStr}_${meal.toLowerCase()}`;
  const dailyReport: DailyMealReport = {
    id: reportId,
    date: todayStr,
    meal: meal,
    hostelId: stats.hostelId || 'GANGPUR_BOYS_HOSTEL',
    openedAt: currentSessionData?.openedAt || nowIso,
    closedAt: nowIso,
    openedBy: currentSessionData?.openedBy || operatorName,
    closedBy: operatorName,
    lunchCount: stats.lunchCount,
    dinnerCount: stats.dinnerCount,
    totalMeals: stats.lunchCount + stats.dinnerCount,
    pendingStudents: stats.pendingStudents,
    totalRevenue: stats.totalRevenue,
    averageScanTime: '1.2s',
    reportGeneratedAt: nowIso,
    status: 'FINALIZED'
  };

  await setDoc(doc(db, 'dailyMealReports', reportId), dailyReport);

  // 3. Log to transactionLogs
  const logId = `tx_log_close_${Date.now()}`;
  await setDoc(doc(db, 'transactionLogs', logId), {
    id: logId,
    action: 'Session Closed',
    mealType: meal,
    operatorName: operatorName,
    timestamp: nowIso
  });

  return dailyReport;
}

/**
 * Sets session to NOT_STARTED for the next meal.
 */
export async function prepareNextMealSession(
  nextMeal: 'Lunch' | 'Dinner',
  operatorName: string = 'Hostel Superintendent'
): Promise<void> {
  const sessionRef = doc(db, 'mealSessions', 'current');
  const todayStr = new Date().toISOString().split('T')[0];

  const session: MealSession = {
    id: 'current',
    currentMeal: nextMeal,
    status: 'NOT_STARTED',
    openedAt: null,
    closedAt: null,
    openedBy: operatorName,
    date: todayStr
  };

  await setDoc(sessionRef, session);

  const logId = `tx_log_meal_change_${Date.now()}`;
  await setDoc(doc(db, 'transactionLogs', logId), {
    id: logId,
    action: 'Meal Changed',
    mealType: nextMeal,
    operatorName: operatorName,
    timestamp: new Date().toISOString()
  });
}
