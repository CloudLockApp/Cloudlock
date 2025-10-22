// firebase-init.js
// IMPORTANT: Load this file with <script type="module" ...>

// Firebase CDN (modular SDK). Pin a recent 10.x version.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  useDeviceLanguage,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// CONFIG.firebase must be defined globally before this script runs.
let app, auth, db;

try {
  app = initializeApp(CONFIG.firebase);
  console.log("✅ Firebase initialized (modular)");

  auth = getAuth(app);
  db = getFirestore(app);

  // Nice-to-haves
  useDeviceLanguage(auth);
  await setPersistence(auth, browserLocalPersistence);

  // Expose for other modules / legacy code that expects globals
  window.app = app;
  window.auth = auth;
  window.db = db;

  console.log("✅ Firebase Auth and Firestore ready");
} catch (error) {
  console.error("❌ Firebase initialization error:", error);
}

// Export for other ES modules
export { app, auth, db };
