// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCtRuHiWnZt_Uq4RWtu6SSqB6GLfmIF1nc",
  authDomain: "suivi-de-caisse.firebaseapp.com",
  projectId: "suivi-de-caisse",
  storageBucket: "suivi-de-caisse.firebasestorage.app",
  messagingSenderId: "615587007724",
  appId: "1:615587007724:web:23d7abd330f237d2f169c9",
  measurementId: "G-QF6DHPGPXC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Services utilisés dans le reste de l'application
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;

// App Firebase secondaire, utilisée UNIQUEMENT pour créer un compte
// (Authentication) depuis l'espace admin sans déconnecter l'admin en cours.
// Sans ça, "createUserWithEmailAndPassword" connecterait automatiquement
// le nouvel utilisateur à la place de l'admin dans le navigateur.
export function getSecondaryAuth() {
  const nom = "Secondary";
  const secondaryApp = getApps().find((a) => a.name === nom) || initializeApp(firebaseConfig, nom);
  return getAuth(secondaryApp);
}
