import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Configuration Firebase (à remplacer par vos propres identifiants lors du déploiement)
const firebaseConfig = {
  apiKey: "AIzaSyAAcArWv37e499EyreInkP9CmMzZCWNtHc",
  authDomain: "pointage-app-noisy.firebaseapp.com",
  projectId: "pointage-app-noisy",
  storageBucket: "pointage-app-noisy.firebasestorage.app",
  messagingSenderId: "187624415462",
  appId: "1:187624415462:web:96848422f4bd63953e9b27",
  measurementId: "G-SVF8EKENDQ"
};

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);

// Initialisation de Firestore
export const db = getFirestore(app);

// Initialisation de l'authentification
export const auth = getAuth(app);

export default app;
