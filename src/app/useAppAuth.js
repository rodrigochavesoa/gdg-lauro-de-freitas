import { useEffect, useRef, useState } from "react";
import { mergeAuthSnapshot, signOutUser, subscribeAuth } from "../features/auth/auth-api.js";
import { invalidateSessionCaches } from "../lib/client-cache/session.js";

const EMPTY_AUTH = { session: null, profile: null, needsOnboarding: false };

/**
 * Sessão do shell: subscribe, hidratação, geração que cancela efeitos e logout.
 * Não desenha rota. O avatar limpa no mesmo turno via `resetAvatarRef`.
 */
export function useAppAuth() {
  const [auth, setAuth] = useState(EMPTY_AUTH);
  const [authReady, setAuthReady] = useState(false);
  const [hydratedUserId, setHydratedUserId] = useState(undefined);
  const [hydrateFailedUserId, setHydrateFailedUserId] = useState(undefined);
  const authGeneration = useRef(0);
  const lastUserId = useRef(null);
  const sessionUserId = useRef(null);
  const avatarRequestKey = useRef(null);
  const resetAvatarRef = useRef(() => {});
  const userId = auth.session?.user?.id ?? null;
  sessionUserId.current = userId;

  useEffect(() => {
    let cancelled = false;
    const applySnapshot = (snapshot, requestEpoch = authGeneration.current) => {
      if (cancelled) return;
      setAuth((current) => {
        if (requestEpoch !== authGeneration.current) return current;
        return mergeAuthSnapshot(current, snapshot);
      });
      if (requestEpoch === authGeneration.current) setAuthReady(true);
    };
    const unsubscribe = subscribeAuth((snapshot, meta) => {
      applySnapshot(snapshot);
      if (cancelled) return;
      const nextUserId = snapshot.session?.user?.id ?? null;
      if (meta?.failed) {
        setHydrateFailedUserId(nextUserId);
        return;
      }
      if (!meta?.hydrated) return;
      setHydrateFailedUserId(undefined);
      setHydratedUserId(nextUserId);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (lastUserId.current !== userId) {
      if (lastUserId.current) {
        invalidateSessionCaches(lastUserId.current);
      }
      if (lastUserId.current != null || userId == null) {
        authGeneration.current += 1;
      }
      lastUserId.current = userId;
      avatarRequestKey.current = null;
    }
  }, [userId]);

  const handleSignOut = async () => {
    authGeneration.current += 1;
    invalidateSessionCaches();
    lastUserId.current = null;
    avatarRequestKey.current = null;
    setAuth(EMPTY_AUTH);
    setHydratedUserId(null);
    setHydrateFailedUserId(undefined);
    resetAvatarRef.current();
    try {
      await signOutUser();
    } finally {
      setAuth(EMPTY_AUTH);
    }
  };

  return {
    auth,
    setAuth,
    authReady,
    hydratedUserId,
    hydrateFailedUserId,
    authGeneration,
    sessionUserId,
    avatarRequestKey,
    resetAvatarRef,
    userId,
    profileReady: Boolean(auth.profile),
    storedAvatarPath: auth.profile?.avatar_path ?? null,
    handleSignOut,
  };
}
