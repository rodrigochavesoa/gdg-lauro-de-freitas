import { useEffect, useState } from "react";
import {
  avatarPublicUrl,
  invalidateAvatarSignedUrl,
  isAvatarUploadEnabled,
  resolveHeaderIdentity,
  saveProfileAvatar,
} from "../features/auth/auth-api.js";

/**
 * Identidade do header: signed URL alinhada a `storedAvatarPath`, guardada por `authGeneration`.
 */
export function useAppAvatar({
  session,
  profile,
  userId,
  profileReady,
  storedAvatarPath,
  authGeneration,
  sessionUserId,
  avatarRequestKey,
  resetAvatarRef,
  setAuth,
}) {
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarPath, setAvatarPath] = useState(null);
  const [avatarStatus, setAvatarStatus] = useState("idle");

  resetAvatarRef.current = () => {
    setAvatarUrl(null);
    setAvatarPath(null);
    setAvatarStatus("idle");
  };

  useEffect(() => {
    const epoch = authGeneration.current;
    if (!userId) {
      avatarRequestKey.current = null;
      setAvatarUrl(null);
      setAvatarPath(null);
      setAvatarStatus("idle");
      return undefined;
    }
    if (!profileReady) {
      setAvatarStatus("loading");
      return undefined;
    }
    if (!storedAvatarPath) {
      avatarRequestKey.current = `${userId}:`;
      setAvatarUrl(null);
      setAvatarPath(null);
      setAvatarStatus("ready");
      return undefined;
    }
    const key = `${userId}:${storedAvatarPath}`;
    if (avatarRequestKey.current === key) {
      return undefined;
    }
    setAvatarStatus("loading");
    let cancelled = false;
    avatarPublicUrl(storedAvatarPath, { userId })
      .then((url) => {
        if (cancelled || epoch !== authGeneration.current) return;
        avatarRequestKey.current = key;
        setAvatarUrl(url);
        setAvatarPath(storedAvatarPath);
        setAvatarStatus("ready");
      })
      .catch(() => {
        if (cancelled || epoch !== authGeneration.current) return;
        avatarRequestKey.current = key;
        setAvatarUrl(null);
        setAvatarPath(storedAvatarPath);
        setAvatarStatus("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, profileReady, storedAvatarPath, authGeneration, avatarRequestKey]);

  const identity = resolveHeaderIdentity({
    session,
    profile,
    avatarUrl,
    avatarPath,
    avatarStatus,
  });

  const onSaveAvatar = isAvatarUploadEnabled()
    ? async (blob) => {
        const epoch = authGeneration.current;
        const currentUserId = sessionUserId.current;
        const profile = await saveProfileAvatar(blob);
        if (epoch !== authGeneration.current) return;
        invalidateAvatarSignedUrl(currentUserId);
        const key = currentUserId && profile.avatar_path
          ? `${currentUserId}:${profile.avatar_path}`
          : null;
        if (key) avatarRequestKey.current = key;
        setAvatarPath(profile.avatar_path);
        setAuth((current) => (current.session ? { ...current, profile } : current));
        try {
          const url = await avatarPublicUrl(profile.avatar_path, { userId: currentUserId });
          if (epoch !== authGeneration.current) return;
          setAvatarUrl(url);
          setAvatarPath(profile.avatar_path);
          setAvatarStatus("ready");
        } catch {
          if (epoch !== authGeneration.current) return;
          setAvatarUrl(null);
          setAvatarPath(profile.avatar_path);
          setAvatarStatus("ready");
        }
      }
    : undefined;

  return { identity, onSaveAvatar };
}
