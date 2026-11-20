/* ==========================================================
   FarNaz Tech – Firebase web configuration
   ----------------------------------------------------------
   Paste YOUR values from: Firebase console > Project settings
   > General > Your apps > Web app > SDK setup and configuration.

   This config is meant to be public. It identifies the project;
   it is NOT a secret. Access is protected by Firestore Security
   Rules and Firebase Authentication, not by hiding these values.
   Never put a service-account key, Cloudinary API secret or any
   other private key in this file.
   ========================================================== */
window.FT_FIREBASE_CONFIG = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};
