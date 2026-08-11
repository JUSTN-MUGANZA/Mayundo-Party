import { Navigate } from "react-router-dom";
import { useAuth } from "../context/contexteAuth";
import { ROLES } from "../constants/roles";

// Page d'accueil "aiguilleuse" : renvoie chaque utilisateur vers l'espace
// correspondant à son rôle, une fois connecté.
export default function HomeRedirect() {
  const { role, loading } = useAuth();
  const normalizedRole = typeof role === "string" ? role.trim().toLowerCase() : role;

  if (loading) {
    return <p style={{ textAlign: "center", marginTop: 80 }}>Chargement...</p>;
  }

  switch (normalizedRole) {
    case ROLES.SUPER_ADMIN:
      return <Navigate to="/super-admin" replace />;
    case ROLES.ADMIN:
      return <Navigate to="/admin" replace />;
    case ROLES.CAISSIER:
      return <Navigate to="/caissier" replace />;
    case ROLES.PRESIDENT:
    case ROLES.CP:
    case ROLES.MEMBRE:
      return <Navigate to="/consultation" replace />;
    default:
      return (
        <p style={{ textAlign: "center", marginTop: 80 }}>
          Aucun rôle n'est associé à ce compte. Contactez l'administrateur.
        </p>
      );
  }
}
