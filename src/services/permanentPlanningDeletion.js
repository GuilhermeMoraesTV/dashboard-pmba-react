import {
  collection, doc, getDocFromServer, getDocsFromServer,
  limit, query, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebaseConfig.js';

const DELETE_PAGE_SIZE = 100;

async function deleteMatching(ref, filters = []) {
  let total = 0;
  for (;;) {
    const page = await getDocsFromServer(query(ref, ...filters, limit(DELETE_PAGE_SIZE)));
    if (page.empty) return total;
    const batch = writeBatch(db);
    page.docs.forEach((item) => batch.delete(item.ref));
    await batch.commit();
    total += page.size;
  }
}

/** Confirmed deletion of all linked stages; each collection is read in small pages. */
export async function deletePermanentPlanning(userId, planningId) {
  const planningRef = doc(db, 'users', userId, 'planejamentos', planningId);
  const planningSnap = await getDocFromServer(planningRef);
  if (!planningSnap.exists()) throw new Error('Planejamento não encontrado.');
  const stages = planningSnap.data().etapas || [];
  for (const stage of stages) {
    const field = stage.metodo === 'ciclo' ? 'cicloId' : 'cronogramaId';
    await deleteMatching(collection(db, 'users', userId, 'registrosEstudo'), [where(field, '==', stage.id)]);
    if (stage.metodo === 'ciclo') {
      await deleteMatching(collection(db, 'users', userId, 'revisoesCiclo'), [where('cicloId', '==', stage.id)]);
      await deleteMatching(collection(db, 'users', userId, 'ciclos', stage.id, 'disciplinas'));
      await deleteMatching(collection(db, 'users', userId, 'ciclos', stage.id, 'rodadas'));
    }
  }
  const batch = writeBatch(db);
  for (const stage of stages) {
    batch.delete(doc(db, 'users', userId, stage.metodo === 'ciclo' ? 'ciclos' : 'cronogramas', stage.id));
  }
  batch.delete(planningRef);
  await batch.commit();
  return stages.length;
}
