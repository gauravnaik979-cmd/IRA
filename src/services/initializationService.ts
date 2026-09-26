import { db, doc, getDoc, setDoc, retryOperation, serverTimestamp } from './firestoreService';
import { initializeRoomsAndHostelsIfMissing } from './roomService';
import { updateHostelCounters } from './studentService';

/**
 * Seeds the default Super Admin account via secure server-side bootstrap
 */
export async function seedSuperAdminAccount(): Promise<void> {
  try {
    const res = await fetch('/api/bootstrap/init', { method: 'POST' });
    if (!res.ok) {
      console.warn('[Bootstrap] Server bootstrap status:', res.status);
    }
  } catch (err) {
    console.warn('[Bootstrap] Server bootstrap request notice:', err);
  }
}

/**
 * Seeds the default Hostel Superintendent admin accounts via secure server-side bootstrap
 */
export async function seedAdminAccount(): Promise<void> {
  // Handled automatically by server-side bootstrap
}

/**
 * Ensures the 'gangpur-boys-hostel' document exists in the 'hostels' collection in Firestore.
 * Creates it with all required fields if missing, then verifies and returns its existence and data.
 */
export async function ensureGangpurHostelExists(): Promise<{ exists: boolean; data: any }> {
  const gangpurHostelRef = doc(db, 'hostels', 'gangpur-boys-hostel');
  let gangpurSnap = await retryOperation(() => getDoc(gangpurHostelRef));
  
  if (!gangpurSnap.exists()) {
    console.log('[Hostels Initialization] Document "hostels/gangpur-boys-hostel" not found. Creating now...');
    await retryOperation(() => setDoc(gangpurHostelRef, {
      name: "Gangpur Boys' Hostel",
      college: "Government Autonomous College, Sundargarh",
      district: "Sundargarh",
      state: "Odisha",
      isActive: true,
      createdAt: serverTimestamp()
    }));
    gangpurSnap = await retryOperation(() => getDoc(gangpurHostelRef));
  }

  const exists = gangpurSnap.exists();
  const data = exists ? gangpurSnap.data() : null;
  console.log(`[Hostels Verification] Collection "hostels", Document "gangpur-boys-hostel" verified. Exists: ${exists}`, data);
  return { exists, data };
}

let hasInitializedSession = false;
let initializingPromise: Promise<void> | null = null;

/**
 * Ensures the database contains all necessary default configurations, settings,
 * hostel metadata, and room structures on launch. Safe to run multiple times.
 */
export async function initializeDatabase(): Promise<void> {
  if (hasInitializedSession) {
    return;
  }
  if (initializingPromise) {
    return initializingPromise;
  }

  initializingPromise = (async () => {
    console.log('Starting IRA Hostel database auto-initialization sequence...');

    try {
      // 1. Initialize default and current meal rates
      const defaultRatesRef = doc(db, 'mealRates', 'default');
      const defaultRatesSnap = await retryOperation(() => getDoc(defaultRatesRef));
      if (!defaultRatesSnap.exists()) {
        await retryOperation(() => setDoc(defaultRatesRef, {
          lunch: 35,
          dinner: 35,
          currency: "INR",
          updatedAt: serverTimestamp()
        }));
        console.log('Populated mealRates/default default document.');
      }

      const currentRatesRef = doc(db, 'mealRates', 'current');
      const currentRatesSnap = await retryOperation(() => getDoc(currentRatesRef));
      if (!currentRatesSnap.exists()) {
        await retryOperation(() => setDoc(currentRatesRef, {
          lunchPrice: 35,
          dinnerPrice: 35,
          currency: "INR",
          updatedAt: serverTimestamp()
        }));
        console.log('Populated mealRates/current default document.');
      }

      // 2. Initialize Gangpur Boys' Hostel Document
      await ensureGangpurHostelExists();

      // 3. Initialize application settings
      const settingsRef = doc(db, 'settings', 'app');
      const settingsSnap = await retryOperation(() => getDoc(settingsRef));
      if (!settingsSnap.exists()) {
        await retryOperation(() => setDoc(settingsRef, {
          hostelName: "Gangpur Boys' Hostel",
          college: "Government Autonomous College, Sundargarh",
          district: "Sundargarh",
          state: "Odisha",
          hostelCapacity: 260,
          academicYear: "2026-2027",
          version: "2.0",
          createdAt: serverTimestamp()
        }));
        console.log('Populated settings/app default document.');
      }

      // 4. Initialize hostel global counters info
      const hostelInfoRef = doc(db, 'hostel', 'info');
      const hostelInfoSnap = await retryOperation(() => getDoc(hostelInfoRef));
      if (!hostelInfoSnap.exists()) {
        await retryOperation(() => setDoc(hostelInfoRef, {
          totalRooms: 0,
          occupiedRooms: 0,
          totalStudents: 0,
          presentToday: 0,
          absentToday: 0,
          onLeave: 0
        }));
        console.log('Populated hostel/info default document.');
      }

      // 5. Initialize rooms & buildings
      await initializeRoomsAndHostelsIfMissing();

      // 6. Seed default Super Admin and Superintendent accounts if not exist
      await seedSuperAdminAccount();
      await seedAdminAccount();

      // 7. Compute global statistics
      await updateHostelCounters();

      hasInitializedSession = true;
      console.log('IRA Hostel database auto-initialization completed successfully.');
    } catch (error) {
      console.error('Critical Error during database auto-initialization:', error);
      throw error;
    } finally {
      initializingPromise = null;
    }
  })();

  return initializingPromise;
}
