import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyC2WNvhk9qz7G63s-hoPcKzVL_io20xdbI",
  authDomain: "nano-6e63f.firebaseapp.com",
  databaseURL: "https://nano-6e63f-default-rtdb.firebaseio.com",
  projectId: "nano-6e63f",
  storageBucket: "nano-6e63f.firebasestorage.app",
  messagingSenderId: "497696973444",
  appId: "1:497696973444:web:e5192dfa37c4e54cfa18d1",
  measurementId: "G-6SVQP1BR8B"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);

export { app, analytics, database };