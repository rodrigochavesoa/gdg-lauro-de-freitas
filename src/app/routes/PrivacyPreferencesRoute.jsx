import React from "react";
import { Navigate } from "react-router-dom";
import { PrivacyPreferences } from "../../features/privacy/PrivacyPreferences.jsx";

export function PrivacyPreferencesRoute({ auth, authReady }) {
  if (auth.needsOnboarding) return <Navigate to="/onboarding" replace />;
  if (auth.session) return <PrivacyPreferences userId={auth.session.user.id} />;
  if (!authReady) return <PrivacyPreferences />;
  return <Navigate to="/login" replace />;
}
