import { getSupabaseBrowserClient } from "../../lib/supabase-client.js";
import {
  isCandidateProfile,
  isD01Complete,
  profilePreferences,
  validateOnboarding,
} from "./profile-completeness.js";

const PROFILE_SELECT = "id,full_name,headline,bio,skills,preferences,role";

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

function displayNameFromUser(user) {
  const meta = user?.user_metadata ?? {};
  const fromMeta = String(meta.full_name || meta.name || "").trim();
  if (fromMeta) return fromMeta;
  const email = String(user?.email ?? "").trim();
  return email ? email.split("@")[0] : "Candidato";
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
    return { session: null, profile: null, needsOnboarding: false };
  }
  const { data, error } = await client.auth.getSession();
  throwIfError(error);
  const session = data.session;
  if (!session?.user) {
    return { session: null, profile: null, needsOnboarding: false };
  }
  const profile = await ensureProfileRow(session.user);
  const needsOnboarding =
    isCandidateProfile(profile) && !isD01Complete(profile, session.user.email);
  return { session, profile, needsOnboarding };
}

export function subscribeAuth(onChange) {
  const client = getSupabaseBrowserClient();
  if (!client) {
    onChange({ session: null, profile: null, needsOnboarding: false });
    return () => {};
  }
  const { data } = client.auth.onAuthStateChange(() => {
    loadAuthSnapshot().then(onChange).catch(() => {
      onChange({ session: null, profile: null, needsOnboarding: false });
    });
  });
  return () => {
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
