import React from "react";
import { useNavigate } from "react-router-dom";
import { Onboarding } from "../../features/auth/Onboarding.jsx";

export function OnboardingRoute({ auth, setAuth, sessionUserId }) {
  const navigate = useNavigate();
  const editingUserId = auth.session?.user?.id;
  return (
    <Onboarding
      profile={auth.profile}
      email={auth.session?.user?.email}
      onSaved={(profile) => {
        if (!editingUserId || sessionUserId.current !== editingUserId) return;
        setAuth((current) => {
          if (current.session?.user?.id !== editingUserId) return current;
          return { ...current, profile, needsOnboarding: false };
        });
        if (sessionUserId.current !== editingUserId) return;
        navigate("/", { replace: true });
      }}
    />
  );
}
