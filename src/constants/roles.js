// Rôles de l'application. Isolés ici (plutôt que dans AuthContext.jsx) pour
// qu'un fichier de composant n'exporte que des composants — sinon le
// rechargement à chaud de Vite ne fonctionne plus correctement sur ce fichier.
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  CAISSIER: "caissier",
  PRESIDENT: "president",
  CP: "cp",
  MEMBRE: "membre",
};
