// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB_6tlt1iMu11Ba0fw2vS6_wVW68NJ06SI",
  authDomain: "sisacef.firebaseapp.com",
  projectId: "sisacef",
  storageBucket: "sisacef.firebasestorage.app",
  messagingSenderId: "729673709435",
  appId: "1:729673709435:web:cca50bdc743289e3f96fde"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
