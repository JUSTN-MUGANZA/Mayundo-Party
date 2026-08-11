import { Navigate } from "react-router-dom";
import { useAuth } from "../context/contexteAuth";

// allowedRoles : tableau de rôles autorisés à voir cette route.
// Si non fourni, la route est ouverte à tout utilisateur connecté.
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, role, loading } = useAuth();
  const normalizedRole = typeof role === "string" ? role.trim().toLowerCase() : role;

  if (loading) {
    return <p style={{ textAlign: "center", marginTop: 80 }}>Chargement...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(normalizedRole)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
