import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

/** The email that is automatically promoted to admin on first sign-in. */
export const BOOTSTRAP_ADMIN_EMAIL = 'okas34744@gmail.com';
