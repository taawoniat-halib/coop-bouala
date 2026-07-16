import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, type Timestamp } from 'firebase/firestore';
import { auth, db, BOOTSTRAP_ADMIN_EMAIL } from '@/lib/firebase';
import type { AppUser, Role } from '@/lib/types';

interface AuthContextValue {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Normalise a Firestore value to an epoch-millis number.
 * Firestore stores `createdAt` as a server Timestamp; the AppUser type
 * expects a `number`. This keeps the in-memory representation consistent
 * regardless of whether the value comes from a fresh write or a read-back.
 */
function toEpochMillis(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value) {
    const ts = value as Timestamp;
    return ts.seconds * 1000 + Math.floor(ts.nanoseconds / 1_000_000);
  }
  return Date.now();
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setAppUser(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        const data = snap.data() as AppUser;
        // Normalise Firestore Timestamp -> number to match the AppUser type.
        if (data.createdAt !== undefined) data.createdAt = toEpochMillis(data.createdAt);
        setAppUser(data);
      } else {
        // First-time sign-in: bootstrap the designated admin email, everyone
        // else starts as a collector until an admin changes their role.
        const role: Role =
          user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL ? 'admin' : 'collector';
        const newUser: AppUser = {
          uid: user.uid,
          email: user.email ?? '',
          displayName: user.displayName ?? undefined,
          role,
          createdAt: Date.now(),
        };
        await setDoc(userRef, { ...newUser, createdAt: serverTimestamp() });
        setAppUser(newUser);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
