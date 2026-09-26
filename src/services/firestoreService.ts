import { db } from '../lib/firebase';
import { 
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  writeBatch, 
  runTransaction,
  serverTimestamp,
  increment,
  DocumentReference,
  DocumentData
} from 'firebase/firestore';

/**
 * Executes an asynchronous Firestore operation with exponential backoff retries.
 */
export async function retryOperation<T>(
  operation: () => Promise<T>, 
  retries = 3, 
  delay = 1000
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      console.warn(`Firestore operation failed, retrying (${i + 1}/${retries})...`, err);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}

/**
 * Creates a Firestore Batch Write instance.
 */
export function createBatch() {
  return writeBatch(db);
}

/**
 * Executes a Firestore transaction.
 */
export async function executeTransaction<T>(
  updateFunction: (transaction: any) => Promise<T>
): Promise<T> {
  return retryOperation(() => runTransaction(db, updateFunction));
}

export {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  increment,
  runTransaction
};
