import React from "react";
import { Navigate } from "react-router-dom";
import { Onboarding } from "../../features/auth/Onboarding.jsx";
import { isCandidateProfile, isD01Complete } from "../../features/auth/profile-completeness.js";
import { STAFF_ROLES } from "../staff-roles.js";

function ProfileEditPending() {
  return (
    <main id="conteudo" tabIndex={-1} className="admin-page">
      <div className="shell admin-shell">
        <section className="admin-content" aria-busy="true">
          <div className="admin-title">
            <div>
              <span className="eyebrow">Perfil</span>
              <h1>Editar perfil</h1>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export function ProfileEditRoute({ auth, authReady, setAuth }) {
  const editingUserId = auth.session?.user?.id;
  if (auth.needsOnboarding) return <Navigate to="/onboarding" replace />;
  if (auth.session) {
    if (auth.profile?.role && STAFF_ROLES.has(auth.profile.role)) {
      return <Navigate to="/" replace />;
    }
    if (!auth.profile) return <ProfileEditPending />;
    return (
      <Onboarding
        mode="edit"
        profile={auth.profile}
        email={auth.session.user.email}
        onSaved={(profile) => {
          setAuth((current) => {
            if (current.session?.user?.id !== editingUserId) return current;
            return {
              ...current,
              profile,
              needsOnboarding: isCandidateProfile(profile) && !isD01Complete(profile, current.session.user.email),
            };
          });
        }}
      />
    );
  }
  if (!authReady) return <ProfileEditPending />;
  return <Navigate to="/login" replace />;
}
