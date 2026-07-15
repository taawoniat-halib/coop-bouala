import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, firebaseConfig as config } from '@/lib/firebase';
import type { AppUser, Role } from '@/lib/types';

/**
 * Creates a new login (collector/accountant/admin) without disturbing the
 * currently signed-in admin's session. Firebase's client SDK normally signs
 * in as whichever user was just created, so this spins up a throwaway
 * secondary app instance to do the sign-up, then tears it down.
 *
 * `extra` merges additional fields onto the created user doc, e.g.
 * `{ memberId }` to link a member's own login to their record.
 *
 * Throws a localised Arabic error when the email is already in use or
 * when the password is too weak, so callers can surface it directly.
 */
export async function adminCreateUser(
  email: string,
  password: string,
  displayName: string,
  role: Role,
  extra: Partial<AppUser> = {},
) {
  const appId = `admin-create-${Date.now()}`;
  const secondaryApp = initializeApp(config, appId);
  try {
    const secondaryAuth = getAuth(secondaryApp);
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/email-already-in-use') {
        throw new Error('هذا البريد الإلكتروني مسجّل بالفعل في النظام.');
      }
      if (code === 'auth/weak-password') {
        throw new Error('كلمة المرور ضعيفة جداً — يجب أن تكون 6 أحرف على الأقل.');
      }
      if (code === 'auth/invalid-email') {
        throw new Error('صيغة البريد الإلكتروني غير صحيحة.');
      }
      throw err;
    }
    await updateProfile(cred.user, { displayName });
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      email,
      displayName,
      role,
      ...extra,
      createdAt: serverTimestamp(),
    });
    // Sign out from the secondary session before destroying the app
    await secondaryAuth.signOut();
  } finally {
    // Always clean up the secondary app to avoid memory/connection leaks
    await deleteApp(secondaryApp).catch(() => {
      /* ignore teardown errors */
    });
  }
}
