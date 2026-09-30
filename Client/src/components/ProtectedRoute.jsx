import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Loading } from "./Common";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loading text="Restoring session…" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function RequireRole({ role }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return user.role === role ? <Outlet /> : <Navigate to="/" replace />;
}

export function RequireAnyRole({ roles }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return roles.includes(user.role) ? <Outlet /> : <Navigate to="/" replace />;
}

export function RequireLabTechResults() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "LAB_TECH") {
    return location.pathname.startsWith("/results") ? (
      <Outlet />
    ) : (
      <Navigate to="/results" replace />
    );
  }

  return <Outlet />;
}
