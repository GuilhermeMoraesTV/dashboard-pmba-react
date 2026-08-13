import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
console.log("📦 Cache Offline configurado (API v10).");

const auth    = getAuth(app);
const storage = getStorage(app);
const authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn('[Firebase] Persistencia local de autenticacao indisponivel:', error);
});

if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
  // connectAuthEmulator(auth, "http://127.0.0.1:9099");
  // connectFirestoreEmulator(db, '127.0.0.1', 8085);
}

export { app, db, auth, storage, authPersistenceReady };
