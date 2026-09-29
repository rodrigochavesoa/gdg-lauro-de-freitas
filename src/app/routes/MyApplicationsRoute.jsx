import React from "react";
import { Navigate } from "react-router-dom";
import { MyApplications } from "../../features/jobs/MyApplications.jsx";

export function MyApplicationsRoute({ auth, authReady }) {
  if (auth.needsOnboarding) return <Navigate to="/onboarding" replace />;
  if (auth.session) return <MyApplications userId={auth.session.user.id} />;
  if (!authReady) return <MyApplications />;
  return <Navigate to="/login" replace />;
}
