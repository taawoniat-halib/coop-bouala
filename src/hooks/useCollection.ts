import { useEffect, useRef, useState } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logAudit } from '@/lib/auditLog';

/**
 * Generic real-time Firestore collection hook.
 *
 * Pass a `queryKey` whenever constraints contain runtime values (e.g. a
 * memberId) so the hook re-subscribes when those values change.
 *
 * FIX: uses a subscription-id ref to prevent stale snapshots from a
 * previous subscription overwriting state after the query changes
 * (race condition guard).
 */
export function useCollection<T extends { id: string }>(
  collectionName: string,
  constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')],
  queryKey: string = '',
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Each subscription gets a unique id; stale callbacks compare against it
  // before calling setData / setLoading to avoid race conditions.
  const activeSubId = useRef(0);

  useEffect(() => {
    const subId = ++activeSubId.current;

    setLoading(true);
    setData([]);

    const q = query(collection(db, collectionName), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap) => {
        // Drop callbacks from superseded subscriptions
        if (subId !== activeSubId.current) return;
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as unknown as T));
        setLoading(false);
        setError(null);
      },
      (err) => {
        if (subId !== activeSubId.current) return;
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsub();
    // queryKey encodes runtime values baked into constraints so we can
    // safely depend on it without serialising QueryConstraint objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, queryKey]);

  const add = async (payload: Omit<T, 'id' | 'createdAt'>) => {
    const cleanPayload = Object.fromEntries(
      Object.entries(payload as Record<string, unknown>).filter(
        ([, value]) => value !== undefined,
      ),
    );
    const ref = await addDoc(collection(db, collectionName), {
      ...cleanPayload,
      createdAt: serverTimestamp(),
    });
    logAudit('create', collectionName, ref.id);
    return ref;
  };

  const update = async (id: string, payload: Partial<T>) => {
    await updateDoc(doc(db, collectionName, id), payload as Record<string, unknown>);
    logAudit('update', collectionName, id);
  };

  const remove = async (id: string) => {
    await deleteDoc(doc(db, collectionName, id));
    logAudit('delete', collectionName, id);
  };

  return { data, loading, error, add, update, remove };
}
