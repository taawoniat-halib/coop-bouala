import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  memoryLocalCache,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const config = __FIREBASE_CONFIG__;

if (!config.apiKey || !config.projectId) {
  // eslint-disable-next-line no-console
  console.error(
    'Firebase config is missing. Set FIREBASE_API_KEY, FIREBASE_PROJECT_ID, etc. as environment secrets.',
  );
}

export const firebaseApp = getApps().length ? getApp() : initializeApp(config);
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

/** The email that is automatically promoted to admin on first sign-in. */
export const BOOTSTRAP_ADMIN_EMAIL = 'okas34744@gmail.com';
