import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { ROLES } from "./constants/roles";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import Landing from "./pages/Landing";
import Login from "./pages/Login";

const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const CaissierDashboard = lazy(() => import("./pages/CaissierDashboard"));
const ConsultationDashboard = lazy(() => import("./pages/ConsultationDashboard"));

function Chargement() {
  return <p style={{ textAlign: "center", marginTop: 80 }}>Chargement...</p>;
}

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Chargement />}>
        <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/super-admin"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/caissier"
          element={
            <ProtectedRoute allowedRoles={[ROLES.CAISSIER]}>
              <CaissierDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/consultation"
          element={
            <ProtectedRoute allowedRoles={[ROLES.PRESIDENT, ROLES.CP, ROLES.MEMBRE]}>
              <ConsultationDashboard />
            </ProtectedRoute>
          }
        />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
