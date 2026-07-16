import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  memoryLocalCache,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
};
const config = firebaseConfig;

if (!config.apiKey || !config.projectId) {
  // eslint-disable-next-line no-console
  console.error(
    'Firebase config is missing. Set FIREBASE_API_KEY, FIREBASE_PROJECT_ID, etc. as environment secrets.',
  );
}

const firebaseApp = getApps().length ? getApp() : initializeApp(config);
export const auth = getAuth(firebaseApp);

// Offline support: cache reads/writes in IndexedDB so the app keeps working
// without a connection (regular accounts can keep logging milk receipts and
// deliveries), and Firestore automatically syncs everything to the server
// as soon as connectivity comes back. Falls back to in-memory cache in
// environments that don't support IndexedDB (e.g. private browsing).
let db: ReturnType<typeof initializeFirestore>;
try {
  db = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({
      tabManager: persistentSingleTabManager({ forceOwnership: false }),
    }),
  });
} catch (err) {
  // eslint-disable-next-line no-console
  console.warn('Falling back to in-memory Firestore cache (offline persistence unavailable):', err);
  db = initializeFirestore(firebaseApp, { localCache: memoryLocalCache() });
}
export { db };

export const storage = getStorage(firebaseApp);

/**
 * The email that is automatically promoted to admin on first sign-in.
 * Set VITE_BOOTSTRAP_ADMIN_EMAIL in your .env / GitHub Actions Secrets.
 * Falls back to empty string so no bootstrap happens if not configured.
 */
export const BOOTSTRAP_ADMIN_EMAIL =
  (import.meta.env.VITE_BOOTSTRAP_ADMIN_EMAIL as string | undefined)?.toLowerCase() ?? '';
