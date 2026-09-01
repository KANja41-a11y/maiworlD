// Paste the web app config from Firebase Console here.
// This file is intentionally safe to publish: Firebase web config is not a password.
// The actual protection comes from Authentication + Realtime Database Security Rules.

export const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://PASTE_YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "PASTE_YOUR_PROJECT",
  storageBucket: "PASTE_YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

export const FIREBASE_READY =
  !firebaseConfig.apiKey.startsWith("PASTE_") &&
  !firebaseConfig.databaseURL.includes("PASTE_");
