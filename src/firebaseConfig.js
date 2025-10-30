// Importe as funções necessárias do SDK do Firebase
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// SUAS CHAVES DE CONFIGURAÇÃO DO FIREBASE
// COLE SEU OBJETO firebaseConfig AQUI
const firebaseConfig = {
      apiKey: "AIzaSyAuvUhMNGk3XAAmlGOnBMgJqmUbxlVrYXw",
      authDomain: "dashboard-pmba.firebaseapp.com",
      projectId: "dashboard-pmba",
      storageBucket: "dashboard-pmba.firebasestorage.app",
      messagingSenderId: "661424378188",
      appId: "1:661424378188:web:82e640b67f4dc9f1cabfe9"
    };

// Inicialize o Firebase
const app = initializeApp(firebaseConfig);

// Exporte os serviços que vamos usar no resto da aplicação
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);