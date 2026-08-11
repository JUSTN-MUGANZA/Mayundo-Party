import { createContext, useContext } from "react";

// Contexte + hook d'accès, séparés du composant <AuthProvider> (AuthContext.jsx)
// pour la même raison que les rôles : un fichier de composants ne doit exporter
// que des composants.
export const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé à l'intérieur de <AuthProvider>");
  }
  return context;
}
