import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Settings } from '@/lib/types';

const SETTINGS_DOC = doc(db, 'settings', 'main');

const DEFAULT_SETTINGS: Settings = {
  coopName: 'تعاونية كوب بوعلا',
  currency: 'MAD',
  milkPurchasePrice: 4.2,
  milkSellPrice: 4.5,
};

/** Single shared settings document (coop name, logo, currency, phone, prices). */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(SETTINGS_DOC, (snap) => {
      if (snap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...(snap.data() as Settings) });
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const updateSettings = async (payload: Partial<Settings>) => {
    await setDoc(SETTINGS_DOC, payload, { merge: true });
  };

  return { settings, loading, updateSettings };
}
