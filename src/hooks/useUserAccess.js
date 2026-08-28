import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { deriveUserAccess } from '../auth/accessControl';

export function useUserAccess(user) {
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(Boolean(user));

  useEffect(() => {
    if (!user?.uid) {
      setUserDoc(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const userRef = doc(db, 'users', user.uid);
    return onSnapshot(userRef, (snap) => {
      setUserDoc(snap.exists() ? snap.data() : null);
      setLoading(false);
    }, () => {
      setUserDoc(null);
      setLoading(false);
    });
  }, [user?.uid]);

  return useMemo(() => ({
    ...deriveUserAccess({ authUser: user, userDoc }),
    userDoc,
    isLoading: loading,
  }), [loading, user, userDoc]);
}
