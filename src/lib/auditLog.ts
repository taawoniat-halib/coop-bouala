import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';

/**
 * Fire-and-forget audit trail. Every create/update/delete performed through
 * `useCollection` lands here so an admin can always answer "من فعل ماذا ومتى؟"
 * for financial data (milk entries, budget, member records...).
 *
 * Failures are swallowed on purpose: a missing audit entry must never block
 * the actual write the user is trying to perform.
 */
export function logAudit(
  action: 'create' | 'update' | 'delete',
  collectionName: string,
  docId: string,
) {
  const user = auth.currentUser;
  if (!user) return;

  addDoc(collection(db, 'audit_log'), {
    actorId: user.uid,
    actorEmail: user.email ?? '',
    actorName: user.displayName ?? '',
    action,
    collection: collectionName,
    docId,
    createdAt: serverTimestamp(),
  }).catch(() => {
    // Best-effort only — never surface audit-log failures to the user.
  });
}
