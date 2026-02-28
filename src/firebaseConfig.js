import { initializeApp } from "firebase/app";
import {
  getFirestore,
  connectFirestoreEmulator,
  enableIndexedDbPersistence, // <--- NOVO IMPORT
  CACHE_SIZE_UNLIMITED
} from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
      apiKey: "AIzaSyAuvUhMNGk3XAAmlGOnBMgJqmUbxlVrYXw",
      authDomain: "dashboard-pmba.firebaseapp.com",
      projectId: "dashboard-pmba",
      storageBucket: "dashboard-pmba.firebasestorage.app",
      messagingSenderId: "661424378188",
      appId: "1:661424378188:web:82e640b67f4dc9f1cabfe9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// --- 1. ATIVAR CACHE PERSISTENTE (OFFLINE) ---
enableIndexedDbPersistence(db, { forceOwnership: false })
  .then(() => {
    console.log("📦 Cache Offline Ativado com Sucesso!");
  })
  .catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn("⚠️ Cache: Múltiplas abas abertas impedem a persistência.");
    } else if (err.code == 'unimplemented') {
        console.warn("⚠️ Cache: Navegador não suporta persistência.");
    }
  });

// --- 2. CONEXÃO COM EMULADORES (Mantenha se usar) ---
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
  // connectAuthEmulator(auth, "http://127.0.0.1:9099");
  // connectFirestoreEmulator(db, '127.0.0.1', 8085);
}

export { db, auth, storage };