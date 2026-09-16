import { getSupabaseBrowserClient } from "../../lib/supabase-client.js";
import {
  isCandidateProfile,
  isD01Complete,
  profilePreferences,
  validateOnboarding,
} from "./profile-completeness.js";

const PROFILE_SELECT = "id,full_name,headline,bio,skills,preferences,role,avatar_path";
export const AVATAR_BUCKET = "avatars";
const AVATAR_SIGNED_TTL_SEC = 60 * 60;

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

/** Signed URL — bucket `avatars` é privado para não expor foto de terceiros. */
export async function avatarPublicUrl(path) {
  if (!path) return null;
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data, error } = await client.storage.from(AVATAR_BUCKET).createSignedUrl(path, AVATAR_SIGNED_TTL_SEC);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function saveProfileAvatar(blob) {
  if (!blob) throw new Error("Escolha uma imagem.");
  const client = clientOrThrow();
  const { data: userData, error: userError } = await client.auth.getUser();
  throwIfError(userError);
  const user = userData.user;
  if (!user) throw new Error("Sessão expirada. Entre novamente com Google.");

  const path = `${user.id}/avatar.jpg`;
  const { error: uploadError } = await client.storage.from(AVATAR_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: blob.type || "image/jpeg",
    cacheControl: "3600",
  });
  throwIfError(uploadError);

  const { data, error } = await client
    .from("profiles")
    .update({
      avatar_path: path,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select(PROFILE_SELECT)
    .single();
  throwIfError(error);
  return data;
}
