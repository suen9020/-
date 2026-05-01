import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDuet8MIFNoz4mzggCZuSA_3TgGlN9Nx8c',
  authDomain: 't1-clean.firebaseapp.com',
  projectId: 't1-clean',
  storageBucket: 't1-clean.firebasestorage.app',
  messagingSenderId: '490844358586',
  appId: '1:490844358586:web:5708c92173dcdefcd1ff83',
  measurementId: 'G-ZRYHMMBXWM',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
