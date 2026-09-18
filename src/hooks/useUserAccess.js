import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebaseConfig';
import { deriveUserAccess } from '../auth/accessControl';
import { syncConsoleAccess } from '../utils/consoleGuard';
import { isUnconfirmedEmptySnapshot } from '../utils/firestoreSnapshotState';

const subscriptionInitializationByUid = new Map();

function ensureSubscriptionOnce(uid) {
  const existing = subscriptionInitializationByUid.get(uid);
  if (existing) return existing;
  const request = httpsCallable(functions, 'ensureUserSubscription')()
    .finally(() => subscriptionInitializationByUid.delete(uid));
  subscriptionInitializationByUid.set(uid, request);
  return request;
}

export function useUserAccess(user) {
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(Boolean(user));
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setUserDoc(null);
      setLoading(false);
      setIsInitializing(false);
      return undefined;
    }

    setLoading(true);
    const userRef = doc(db, 'users', user.uid);
    let requestedInitialization = false;
    let initTimeoutId = null;

    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (isUnconfirmedEmptySnapshot(snap)) return;
      const data = snap.exists() ? snap.data() : null;
      setUserDoc(data);
      setLoading(false);

      // Se o documento existe mas ainda não possui subscription completo
      const sub = data?.subscription;
      const hasCompleteSubscription = Boolean(sub && sub.plan && sub.status);

      if (!hasCompleteSubscription) {
        setIsInitializing(true);
        if (!requestedInitialization) {
          requestedInitialization = true;
          initTimeoutId = setTimeout(() => {
            setIsInitializing(false);
          }, 4000);
          try {
            void ensureSubscriptionOnce(user.uid)
              .then((result) => {
                if (initTimeoutId) clearTimeout(initTimeoutId);
                if (result?.data?.subscription) {
                  setUserDoc((curr) => (curr ? { ...curr, subscription: result.data.subscription } : curr));
                }
                setIsInitializing(false);
              })
              .catch((err) => {
                if (initTimeoutId) clearTimeout(initTimeoutId);
                console.warn('[useUserAccess] Falha ao solicitar inicialização de assinatura no servidor:', err?.message || err);
                setIsInitializing(false);
              });
          } catch (err) {
            if (initTimeoutId) clearTimeout(initTimeoutId);
            console.warn('[useUserAccess] Erro ao invocar ensureUserSubscription:', err?.message || err);
            setIsInitializing(false);
          }
        }
      } else {
        if (initTimeoutId) clearTimeout(initTimeoutId);
        setIsInitializing(false);
      }
    }, () => {
      if (initTimeoutId) clearTimeout(initTimeoutId);
      setUserDoc(null);
      setLoading(false);
      setIsInitializing(false);
    });

    return () => {
      if (initTimeoutId) clearTimeout(initTimeoutId);
      unsubscribe();
    };
  }, [user?.uid]);

  const access = useMemo(() => deriveUserAccess({ authUser: user, userDoc }), [user, userDoc]);

  useEffect(() => {
    syncConsoleAccess(Boolean(access.isAdmin));
  }, [access.isAdmin]);

  return useMemo(() => ({
    ...access,
    userDoc,
    isLoading: loading || isInitializing || Boolean(access.isPendingInitialization),
    isInitializing: isInitializing || Boolean(access.isPendingInitialization),
  }), [access, isInitializing, loading, userDoc]);
}
