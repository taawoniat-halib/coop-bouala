import { useEffect, useState } from 'react';
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

  /**
   * Generic real-time Firestore collection hook.
   *
   * Pass a `queryKey` whenever constraints contain runtime values (e.g. a
   * memberId) so the hook re-subscribes when those values change.
   */
  export function useCollection<T extends { id: string }>(
    collectionName: string,
    constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')],
    queryKey: string = '',
  ) {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      setLoading(true);
      const q = query(collection(db, collectionName), ...constraints);
      const unsub = onSnapshot(
        q,
        (snap) => {
          setData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as unknown as T));
          setLoading(false);
          setError(null);
        },
        (err) => {
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
        Object.entries(payload).filter(([, value]) => value !== undefined),
      );
      return addDoc(collection(db, collectionName), { ...cleanPayload, createdAt: serverTimestamp() });
    };

    const update = async (id: string, payload: Partial<T>) =>
      updateDoc(doc(db, collectionName, id), payload as Record<string, unknown>);

    const remove = async (id: string) => deleteDoc(doc(db, collectionName, id));

    return { data, loading, error, add, update, remove };
  }
  