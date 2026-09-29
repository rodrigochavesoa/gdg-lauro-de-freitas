import React from "react";
import { Navigate } from "react-router-dom";
import { Login } from "../../features/auth/Login.jsx";

export function LoginRoute({ auth }) {
  if (auth.needsOnboarding) return <Navigate to="/onboarding" replace />;
  if (auth.session) return <Navigate to="/" replace />;
  return <Login />;
}
