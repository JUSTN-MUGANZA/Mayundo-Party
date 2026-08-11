import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { AuthContext } from "./contexteAuth";

// Durée d'inactivité avant déconnexion automatique — sécurité pour éviter
// qu'une session (surtout un caissier) reste ouverte sur un appareil partagé.
// Toute activité utilisateur (touche, clic, scroll) réarme le minuteur.
const DUREE_INACTIVITE_MS = 60 * 60 * 1000; // 1 heure

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const minuteurDeconnexion = useRef(null);

  const rearmerMinuteur = useCallback(() => {
    if (minuteurDeconnexion.current) clearTimeout(minuteurDeconnexion.current);
    minuteurDeconnexion.current = setTimeout(() => {
      signOut(auth);
    }, DUREE_INACTIVITE_MS);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const snap = await getDoc(doc(db, "utilisateurs", currentUser.uid));
          setUser(currentUser);
          const rawRole = snap.exists() ? snap.data().role : null;
          setRole(typeof rawRole === "string" ? rawRole.trim().toLowerCase() : null);
        } catch (err) {
          console.error("Erreur lors de la récupération du rôle :", err);
          setUser(currentUser);
          setRole(null);
        }
        rearmerMinuteur();
      } else {
        setUser(null);
        setRole(null);
        if (minuteurDeconnexion.current) {
          clearTimeout(minuteurDeconnexion.current);
          minuteurDeconnexion.current = null;
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (minuteurDeconnexion.current) clearTimeout(minuteurDeconnexion.current);
    };
  }, [rearmerMinuteur]);

  // Réarme le minuteur tant que l'utilisateur est actif (mobile + desktop).
  useEffect(() => {
    if (!user) return undefined;
    const evenements = ["pointerdown", "keydown", "touchstart", "scroll"];
    const onActivite = () => rearmerMinuteur();
    evenements.forEach((e) => window.addEventListener(e, onActivite, { passive: true }));
    return () => {
      evenements.forEach((e) => window.removeEventListener(e, onActivite));
    };
  }, [user, rearmerMinuteur]);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
