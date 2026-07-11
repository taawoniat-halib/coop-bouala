import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Role } from '@/lib/types';

const config = __FIREBASE_CONFIG__;

/**
 * Creates a new login (collector/accountant/admin) without disturbing the
 * currently signed-in admin's session. Firebase's client SDK normally signs
 * in as whichever user was just created, so this spins up a throwaway
 * secondary app instance to do the sign-up, then tears it down.
 */
export async function adminCreateUser(
  email: string,
  password: string,
  displayName: string,
  role: Role,
) {
  const secondaryApp = initializeApp(config, `admin-create-${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondaryApp);
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      email,
      password,
    );
    await updateProfile(cred.user, { displayName });
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      email,
      displayName,
      role,
      createdAt: serverTimestamp(),
    });
    await secondaryAuth.signOut();
  } finally {
    await deleteApp(secondaryApp);
  }
}
