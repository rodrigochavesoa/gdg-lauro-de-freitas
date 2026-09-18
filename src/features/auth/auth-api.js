import { getSupabaseBrowserClient } from "../../lib/supabase-client.js";
import {
  isCandidateProfile,
  isD01Complete,
  profilePreferences,
  validateOnboarding,
} from "./profile-completeness.js";

const PROFILE_SELECT = "id,full_name,headline,bio,skills,preferences,role,avatar_path";
export const AVATAR_BUCKET = "avatars";
export const AVATAR_OBJECT = "avatar.jpg";
const AVATAR_SIGNED_TTL_SEC = 60 * 60;
/** Memory-only cache expires before the signed URL itself. */
export const AVATAR_SIGNED_CACHE_TTL_MS = (AVATAR_SIGNED_TTL_SEC - 5 * 60) * 1000;
const AVATAR_CACHE_CONTROL = "0";

const avatarSignedUrlCache = new Map();
const avatarSignedUrlInflight = new Map();

function avatarSignedUrlKey(userId, path) {
  if (!userId || !path) return null;
  return `${userId}:${path}`;
}

export function invalidateAvatarSignedUrl(userId, path) {
  const key = avatarSignedUrlKey(userId, path);
  if (key) {
    avatarSignedUrlCache.delete(key);
    avatarSignedUrlInflight.delete(key);
    return;
  }
  if (userId) {
    const prefix = `${userId}:`;
    for (const cachedKey of [...avatarSignedUrlCache.keys()]) {
      if (cachedKey.startsWith(prefix)) avatarSignedUrlCache.delete(cachedKey);
    }
    for (const cachedKey of [...avatarSignedUrlInflight.keys()]) {
      if (cachedKey.startsWith(prefix)) avatarSignedUrlInflight.delete(cachedKey);
    }
    return;
  }
  avatarSignedUrlCache.clear();
  avatarSignedUrlInflight.clear();
}

export function peekAvatarSignedUrl(userId, path) {
  const key = avatarSignedUrlKey(userId, path);
  if (!key) return null;
  const entry = avatarSignedUrlCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > AVATAR_SIGNED_CACHE_TTL_MS) return null;
  return entry.url;
}

export function avatarStoragePath(userId) {
  if (!userId) throw new Error("Sessão expirada. Entre novamente com Google.");
  return `${userId}/${AVATAR_OBJECT}`;
}

/** Homologação/Preview: VITE_AVATAR_UPLOAD_ENABLED=true. Production: ausente até Camada B. */
export function isAvatarUploadEnabled() {
  return import.meta.env.VITE_AVATAR_UPLOAD_ENABLED === "true";
}

function clientOrThrow() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("VITE_SUPABASE_URL e chave publishable/anon não configuradas.");
  }
  return client;
}

function throwIfError(error) {
  if (error) {
    throw new Error(error.message || "Falha na API do Supabase.");
  }
}

export function emptyAuthSnapshot() {
  return { session: null, profile: null, needsOnboarding: false };
}

export function displayNameFromUser(user) {
  const meta = user?.user_metadata ?? {};
  const fromMeta = String(meta.full_name || meta.name || "").trim();
  if (fromMeta) return fromMeta;
  const email = String(user?.email ?? "").trim();
  return email ? email.split("@")[0] : "Candidato";
}

/**
 * Identidade do header: skeleton até perfil (e signed URL, se houver path) confirmados.
 * Não usa metadata/Google como nome ou foto transitórios.
 * `avatarPath` deve ser o path da URL atual — mismatch = pending, nunca foto de outro user.
 */
export function resolveHeaderIdentity({ session, profile, avatarUrl, avatarPath, avatarStatus }) {
  if (!session?.user) {
    return { pending: false, displayName: "", avatarUrl: null };
  }
  if (!profile) {
    return { pending: true, displayName: "", avatarUrl: null };
  }
  const displayName = String(profile.full_name ?? "").trim() || "Candidato";
  if (!profile.avatar_path) {
    return { pending: false, displayName, avatarUrl: null };
  }
  const bound = avatarPath === profile.avatar_path && avatarStatus === "ready";
  if (!bound) {
    return { pending: true, displayName: "", avatarUrl: null };
  }
  if (avatarUrl) {
    return { pending: false, displayName, avatarUrl };
  }
  return { pending: false, displayName, avatarUrl: null };
}

/** Mantém o perfil no TOKEN_REFRESHED / snapshot só-sessão do mesmo userId. */
export function mergeAuthSnapshot(current, incoming) {
  if (!incoming?.session?.user) {
    return emptyAuthSnapshot();
  }
  const sameUser = current?.session?.user?.id === incoming.session.user.id;
  if (incoming.profile == null && sameUser && current?.profile) {
    return {
      session: incoming.session,
      profile: current.profile,
      needsOnboarding: current.needsOnboarding,
    };
  }
  return {
    session: incoming.session,
    profile: incoming.profile ?? null,
    needsOnboarding: Boolean(incoming.needsOnboarding),
  };
}

function snapshotFromSession(session, profile, needsOnboarding) {
  if (!session?.user) return emptyAuthSnapshot();
  return {
    session,
    profile: profile ?? null,
    needsOnboarding: Boolean(needsOnboarding),
  };
}

async function fetchProfile(client, userId) {
  const { data, error } = await client
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();
  throwIfError(error);
  return data;
}

/** Cria a linha se faltar. Nunca envia `role` — default do banco é candidate. */
export async function ensureProfileRow(user) {
  const client = clientOrThrow();
  const existing = await fetchProfile(client, user.id);
  if (existing) return existing;

  const { error } = await client.from("profiles").insert({
    id: user.id,
    full_name: displayNameFromUser(user),
  });
  if (error && !/duplicate|unique/i.test(error.message)) {
    throwIfError(error);
  }
  return fetchProfile(client, user.id);
}

export async function loadAuthSnapshot() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return emptyAuthSnapshot();
  }
  const { data, error } = await client.auth.getSession();
  throwIfError(error);
  const session = data.session;
  if (!session?.user) {
    return emptyAuthSnapshot();
  }
  const profile = await ensureProfileRow(session.user);
  const needsOnboarding =
    isCandidateProfile(profile) && !isD01Complete(profile, session.user.email);
  return { session, profile, needsOnboarding };
}

export function subscribeAuth(onChange) {
  const client = getSupabaseBrowserClient();
  if (!client) {
    onChange(emptyAuthSnapshot());
    return () => {};
  }

  let lastUserId = null;
  let lastProfile = null;
  let lastNeedsOnboarding = false;
  let hydrateGen = 0;

  const applySignedOut = () => {
    hydrateGen += 1;
    lastUserId = null;
    lastProfile = null;
    lastNeedsOnboarding = false;
    onChange(emptyAuthSnapshot());
  };

  const { data } = client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session?.user) {
      applySignedOut();
      return;
    }

    const sameUser = lastUserId === session.user.id;
    const profile = sameUser ? lastProfile : null;
    const needsOnboarding = sameUser ? lastNeedsOnboarding : false;
    if (!sameUser) {
      lastProfile = null;
      lastNeedsOnboarding = false;
    }
    lastUserId = session.user.id;
    onChange(snapshotFromSession(session, profile, needsOnboarding));

    const gen = ++hydrateGen;
    loadAuthSnapshot()
      .then((snapshot) => {
        if (gen !== hydrateGen) return;
        if (!snapshot.session?.user) {
          applySignedOut();
          return;
        }
        lastUserId = snapshot.session.user.id;
        lastProfile = snapshot.profile;
        lastNeedsOnboarding = snapshot.needsOnboarding;
        onChange(snapshot);
      })
      .catch(() => {
        if (gen !== hydrateGen) return;
      });
  });

  return () => {
    hydrateGen += 1;
    data.subscription.unsubscribe();
  };
}

export async function startGoogleOAuth() {
  const client = clientOrThrow();
  const redirectTo = `${window.location.origin}/`;
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  throwIfError(error);
}

export async function signOutUser() {
  const client = getSupabaseBrowserClient();
  if (client) {
    await client.auth.signOut();
  }
}

export async function saveOnboardingProfile({
  fullName,
  experienceLevel,
  skillsText,
  location,
  workModel,
  bio,
  linkedin,
  github,
  cvUrl,
}) {
  const { errors, skills } = validateOnboarding({
    fullName,
    experienceLevel,
    skillsText,
    location,
    workModel,
  });
  if (errors.length) throw new Error(errors[0]);

  const client = clientOrThrow();
  const { data: userData, error: userError } = await client.auth.getUser();
  throwIfError(userError);
  const user = userData.user;
  if (!user) throw new Error("Sessão expirada. Entre novamente com Google.");

  const current = await fetchProfile(client, user.id);
  const previous = profilePreferences(current);
  const preferences = {
    ...previous,
    experience_level: experienceLevel,
    work_model: workModel,
    location: String(location).trim(),
    linkedin: String(linkedin ?? "").trim() || null,
    github: String(github ?? "").trim() || null,
    cv_url: String(cvUrl ?? "").trim() || null,
  };

  const { data, error } = await client
    .from("profiles")
    .update({
      full_name: String(fullName).trim(),
      bio: String(bio ?? "").trim() || null,
      skills,
      preferences,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select(PROFILE_SELECT)
    .single();
  throwIfError(error);
  return data;
}

/** Signed URL — bucket `avatars` é privado para não expor foto de terceiros. Cache só em memória. */
export async function avatarPublicUrl(path, { userId, forceRefresh } = {}) {
  if (!path) return null;
  const key = avatarSignedUrlKey(userId, path);

  if (key && !forceRefresh) {
    const cached = peekAvatarSignedUrl(userId, path);
    if (cached) return cached;
    const inflight = avatarSignedUrlInflight.get(key);
    if (inflight) return inflight;
  }

  const client = getSupabaseBrowserClient();
  if (!client) return null;

  const request = client.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, AVATAR_SIGNED_TTL_SEC)
    .then(({ data, error }) => {
      if (error || !data?.signedUrl) return null;
      if (key) {
        avatarSignedUrlCache.set(key, { url: data.signedUrl, fetchedAt: Date.now() });
      }
      return data.signedUrl;
    });

  if (key) avatarSignedUrlInflight.set(key, request);
  try {
    return await request;
  } finally {
    if (key && avatarSignedUrlInflight.get(key) === request) {
      avatarSignedUrlInflight.delete(key);
    }
  }
}

export async function saveProfileAvatar(blob) {
  if (!isAvatarUploadEnabled()) {
    throw new Error("Upload de foto indisponível neste ambiente.");
  }
  if (!blob) throw new Error("Escolha uma imagem.");
  const client = clientOrThrow();
  const { data: userData, error: userError } = await client.auth.getUser();
  throwIfError(userError);
  const user = userData.user;
  if (!user) throw new Error("Sessão expirada. Entre novamente com Google.");

  const path = avatarStoragePath(user.id);
  const { error: uploadError } = await client.storage.from(AVATAR_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: blob.type || "image/jpeg",
    cacheControl: AVATAR_CACHE_CONTROL,
  });
  throwIfError(uploadError);
  invalidateAvatarSignedUrl(user.id, path);

  const persistPath = async () =>
    client
      .from("profiles")
      .update({
        avatar_path: path,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select(PROFILE_SELECT)
      .single();

  const first = await persistPath();
  if (!first.error) return first.data;
  const retry = await persistPath();
  throwIfError(retry.error);
  return retry.data;
}
