import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Replace these values with your Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyBmPv9SFaICnCrOuWJAhLMTBUeSYvOJE9c",
  authDomain: "planning-poker-8039e.firebaseapp.com",
  projectId: "planning-poker-8039e",
  storageBucket: "planning-poker-8039e.firebasestorage.app",
  messagingSenderId: "87746305811",
  appId: "1:87746305811:web:5c116a105ac7d30bd8c4e6",
  measurementId: "G-K5796Z6XLQ"
};


const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
