// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js"; // Importar getStorage

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBw9UPb-F6Scxa6sjI27lRE-xkHwtkd12Q",
  authDomain: "sisacef.firebaseapp.com",
  projectId: "sisacef",
  storageBucket: "sisacef.appspot.com",
  messagingSenderId: "729673709435",
  appId: "1:729673709435:web:48a6f1f7d1b32efef96fde"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

// Initialize Firebase Storage and get a reference to the service
const storage = getStorage(app); // Inicializar Storage

export { db, storage }; // Exportar db y storage