import { Navigate, useLocation } from "react-router-dom";
import { useAuth, UserRole } from "./AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect to their correct dashboard
    if (user.role === "doctor") return <Navigate to="/doctor-dashboard" replace />;
    if (user.role === "nurse") return <Navigate to="/nurse-dashboard" replace />;
    if (user.role === "admin")  return <Navigate to="/admin-dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
