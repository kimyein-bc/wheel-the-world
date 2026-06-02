import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";



  const firebaseConfig = {
  apiKey: "AIzaSyC05oV-23uDi5QuJ6hulI8FxNCNtVIhg0Q",
  authDomain: "wheel-the-world-4a59d.firebaseapp.com",
  projectId: "wheel-the-world-4a59d",
  storageBucket: "wheel-the-world-4a59d.firebasestorage.app",
  messagingSenderId: "176525025322",
  appId: "1:176525025322:web:57bf9cd550c89bbb6c2353",
  measurementId: "G-VKDSX9DF3N"
};
  apiKey: "...",
  authDomain: "...",
  databaseURL: "https://wheel-the-world-4a59d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);