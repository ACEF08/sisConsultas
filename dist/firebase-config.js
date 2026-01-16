

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBw9UPb-F6Scxa6sjI27lRE-xkHwtkd12Q",
  authDomain: "sisacef.firebaseapp.com",
  projectId: "sisacef",
  storageBucket: "sisacef.firebasestorage.app",
  messagingSenderId: "729673709435",
  appId: "1:729673709435:web:48a6f1f7d1b32efef96fde"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage };
