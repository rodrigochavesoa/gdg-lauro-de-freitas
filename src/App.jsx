import React from "react";
import { Footer } from "./shared/ui/Footer.jsx";
import { Header } from "./shared/ui/Header.jsx";
import { ScrollToTop } from "./shared/ui/ScrollToTop.jsx";
import { SkipLink } from "./shared/ui/SkipLink.jsx";
import { AppRoutes } from "./app/AppRoutes.jsx";
import { useAppAuth } from "./app/useAppAuth.js";
import { useAppAvatar } from "./app/useAppAvatar.js";
import { useCandidatePrefetch } from "./app/useCandidatePrefetch.js";
import { useCatalogPrefetch } from "./app/useCatalogPrefetch.js";

export function App() {
  const shell = useAppAuth();
  const avatar = useAppAvatar({
    session: shell.auth.session,
    profile: shell.auth.profile,
    userId: shell.userId,
    profileReady: shell.profileReady,
    storedAvatarPath: shell.storedAvatarPath,
    authGeneration: shell.authGeneration,
    sessionUserId: shell.sessionUserId,
    avatarRequestKey: shell.avatarRequestKey,
    resetAvatarRef: shell.resetAvatarRef,
    setAuth: shell.setAuth,
  });
  useCatalogPrefetch();
  useCandidatePrefetch({
    userId: shell.userId,
    role: shell.auth.profile?.role,
    needsOnboarding: shell.auth.needsOnboarding,
  });

  return (
    <>
      <ScrollToTop />
      <SkipLink />
      <Header
        logged={Boolean(shell.auth.session)}
        displayName={avatar.identity.displayName}
        email={shell.auth.session?.user?.email || ""}
        role={shell.auth.profile?.role}
        avatarUrl={avatar.identity.avatarUrl}
        identityPending={avatar.identity.pending}
        needsOnboarding={shell.auth.needsOnboarding}
        authReady={shell.authReady}
        onSignOut={shell.handleSignOut}
        onSaveAvatar={avatar.onSaveAvatar}
      />
      <AppRoutes
        auth={shell.auth}
        setAuth={shell.setAuth}
        authReady={shell.authReady}
        hydratedUserId={shell.hydratedUserId}
        hydrateFailedUserId={shell.hydrateFailedUserId}
        sessionUserId={shell.sessionUserId}
        viewerAvatarUrl={avatar.identity.avatarUrl}
        viewerDisplayName={avatar.identity.displayName}
      />
      <Footer />
    </>
  );
}
