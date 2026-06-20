// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// 💡 찾으신 실제 Firebase 설정값들이 완벽하게 적용되었습니다!
const firebaseConfig = {
  apiKey: "AIzaSyC05oV-23uDi5QuJ6hulI8FxNCNtVIhg0Q",
  authDomain: "wheel-the-world-4a59d.firebaseapp.com",
  // 흰 화면 에러를 내던 주소를 내 프로젝트 ID에 맞게 정확하게 자동 매칭했습니다.
  databaseURL: "https://wheel-the-world-4a59d-default-rtdb.firebaseio.com", 
  projectId: "wheel-the-world-4a59d",
  storageBucket: "wheel-the-world-4a59d.firebasestorage.app",
  messagingSenderId: "176525025322",
  appId: "1:176525025322:web:57bf9cd550c89bbb6c2353",
  measurementId: "G-VKDSX9DF3N"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// App.jsx 파일에서 불러와서 사용할 수 있도록 내보내기(export)
export const auth = getAuth(app);
export const db = getDatabase(app);