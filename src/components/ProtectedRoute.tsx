import { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

type Props = {
  children: ReactNode;
  role?: "admin" | "user" | "scorer";
};

export function ProtectedRoute({ children, role }: Props) {
  const { user, token } = useAuth();

  if (!token || !user) {
    return <Navigate to="/login" />;
  }

  if (role && user.role !== role) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
}