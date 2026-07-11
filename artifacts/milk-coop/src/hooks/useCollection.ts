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
 * Generic real-time Firestore collection hook. Give it a collection name and
 * it returns the live list plus add/update/remove helpers. `createdAt` is
 * always stamped by the server on add.
 */
export function useCollection<T extends { id: string }>(
  collectionName: string,
  constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')],
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
        setData(
          snap.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as unknown as T,
          ),
        );
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName]);

  const add = async (payload: Omit<T, 'id' | 'createdAt'>) => {
    return addDoc(collection(db, collectionName), {
      ...payload,
      createdAt: serverTimestamp(),
    });
  };

  const update = async (id: string, payload: Partial<T>) => {
    return updateDoc(doc(db, collectionName, id), payload as Record<string, unknown>);
  };

  const remove = async (id: string) => {
    return deleteDoc(doc(db, collectionName, id));
  };

  return { data, loading, error, add, update, remove };
}
