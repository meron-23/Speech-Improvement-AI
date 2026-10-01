import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// The backend handles Admin functions, but the frontend needs
// to authenticate with Custom Tokens to securely interact (or just use the backend).
// The user prompt said: "Frontend logs in using token. No passwords. No signup."
// However, since we are doing everything via the Python backend according to the prompt
// ("Call backend function: Verify student exists in Firestore, Generate Firebase custom token")
// we actually just need to use `signInWithCustomToken` on the frontend if we want
// to use Firestore directly from the frontend, OR just pass the token to our custom backend API.
// The requirements said "Store ONE document per session", "Call backend function to login",
// "End Session -> Trigger feedback generation -> Save session".
// Since we have backend endpoints for all of this (`/session/save`, `/sessions`, `/export`), 
// we don't strictly need Firestore directly accessed from the frontend.
// But we still need `signInWithCustomToken` from Firebase Auth.

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSy_dummy_key_for_dev",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "speech-improvement-ai.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "speech-improvement-ai",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "speech-improvement-ai.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:000000000000:web:0000000000000000000000"
};

// Initialize Firebase safely
let app;
let auth;
let db;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (err) {
  console.warn("Firebase client initialization warning:", err);
}

export { auth, db };

