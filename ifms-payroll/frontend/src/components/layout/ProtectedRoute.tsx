/** Layout: `ProtectedRoute` — shell, nav, or auth guard. */
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: string[];
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isLoggedIn, hasRole, user } = useAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.force_password_change && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  if (roles?.length && !roles.some((r) => hasRole(r))) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
