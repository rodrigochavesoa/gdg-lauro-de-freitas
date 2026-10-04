import React from "react";
import { Navigate, useOutletContext } from "react-router-dom";
import { CommunityRoute } from "../community/Community.jsx";
import { isStaffRole } from "./staff-access.js";

export function AdminCommunityRoute() {
  const { profile, session } = useOutletContext();
  if (!isStaffRole(profile?.role)) return <Navigate to="/admin" replace />;

  return (
    <CommunityRoute
      auth={{ session, profile, needsOnboarding: false }}
      authReady
      embedded
    />
  );
}
