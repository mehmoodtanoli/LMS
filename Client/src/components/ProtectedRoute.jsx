import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Loading } from "./Common";
export default function ProtectedRoute() { const { user, loading } = useAuth(); return loading ? <Loading text="Restoring session…" /> : user ? <Outlet /> : <Navigate to="/login" replace />; }
