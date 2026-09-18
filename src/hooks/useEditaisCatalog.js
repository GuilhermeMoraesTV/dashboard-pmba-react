import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { CATALOGO_EDITAIS } from '../pages/AdminPage/EditaisManager';
import { buildEditaisMap } from '../components/admin/config/editalAssets';
import { isUnconfirmedEmptySnapshot } from '../utils/firestoreSnapshotState';

let sharedMap = buildEditaisMap(CATALOGO_EDITAIS);
let sharedUnsubscribe = null;
const subscribers = new Set();

const notifySubscribers = () => {
  subscribers.forEach((subscriber) => subscriber(sharedMap));
};

const startSharedSubscription = () => {
  if (sharedUnsubscribe) return;
  sharedUnsubscribe = onSnapshot(collection(db, 'editais_templates'), (snapshot) => {
    if (isUnconfirmedEmptySnapshot(snapshot)) return;
    const merged = new Map(CATALOGO_EDITAIS.map((item) => [String(item.id), item]));
    snapshot.docs.forEach((docSnap) => {
      const stored = { id: docSnap.id, ...docSnap.data() };
      const local = merged.get(String(docSnap.id));
      merged.set(String(docSnap.id), {
        ...local,
        ...stored,
        logoUrl: stored.logoUrl || stored.logo || local?.logoUrl || local?.logo || null,
      });
    });
    sharedMap = buildEditaisMap([...merged.values()]);
    notifySubscribers();
  }, () => {
    sharedMap = buildEditaisMap(CATALOGO_EDITAIS);
    notifySubscribers();
  });
};

const stopSharedSubscriptionIfUnused = () => {
  if (subscribers.size > 0 || !sharedUnsubscribe) return;
  sharedUnsubscribe();
  sharedUnsubscribe = null;
};

export function useEditaisCatalog() {
  const [editaisMap, setEditaisMap] = useState(sharedMap);

  useEffect(() => {
    subscribers.add(setEditaisMap);
    setEditaisMap(sharedMap);
    startSharedSubscription();

    return () => {
      subscribers.delete(setEditaisMap);
      stopSharedSubscriptionIfUnused();
    };
  }, []);

  return editaisMap;
}
