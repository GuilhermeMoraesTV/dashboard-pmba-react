import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig.js';
import { isStudyRecordLinkedToPlan } from '../utils/planDeletion.js';

const DELETE_BATCH_SIZE = 400;

export async function deletePlanStudyRecords({ userId, planId, planType }) {
  if (!userId || !planId) return 0;

  const snapshot = await getDocs(collection(db, 'users', userId, 'registrosEstudo'));
  const refs = snapshot.docs
    .filter((item) => isStudyRecordLinkedToPlan(item.data(), planId, planType))
    .map((item) => item.ref);

  for (let index = 0; index < refs.length; index += DELETE_BATCH_SIZE) {
    const batch = writeBatch(db);
    refs.slice(index, index + DELETE_BATCH_SIZE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  return refs.length;
}
