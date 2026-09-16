import { getSupabaseBrowserClient } from "../../lib/supabase-client.js";
import { redactForLog } from "../../lib/privacy-redaction.js";
import { PRIVACY_PURPOSES, latestEventsByPurpose } from "./privacy-catalog.js";

export const PRIVACY_PREFERENCES_CACHE_TTL_MS = 30_000;

const privacyPreferencesCache = new Map();
const privacyPreferencesInflight = new Map();

function clientOrThrow() {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("VITE_SUPABASE_URL e chave publishable/anon não configuradas.");
  return client;
}

function throwIfError(error) {
  if (!error) return;
  const safe = redactForLog({
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
  throw new Error(safe.message || "Não foi possível atualizar suas preferências.");
}

function sortPurposes(rows) {
  return [...rows].sort((left, right) => left.purpose_code.localeCompare(right.purpose_code));
}

function parseLoadPrivacyOptions(userIdOrOptions) {
  if (userIdOrOptions && typeof userIdOrOptions === "object" && !Array.isArray(userIdOrOptions)) {
    return {
      userId: userIdOrOptions.userId,
      forceRefresh: Boolean(userIdOrOptions.forceRefresh),
    };
  }
  return { userId: userIdOrOptions, forceRefresh: false };
}

export function invalidatePrivacyPreferencesCache(userId) {
  if (userId) {
    privacyPreferencesCache.delete(userId);
    privacyPreferencesInflight.delete(userId);
    return;
  }
  privacyPreferencesCache.clear();
  privacyPreferencesInflight.clear();
}

export function peekPrivacyPreferencesCache(userId) {
  if (!userId) return null;
  const entry = privacyPreferencesCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > PRIVACY_PREFERENCES_CACHE_TTL_MS) return null;
  return entry.data;
}

async function fetchPrivacyPreferences() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return { purposes: PRIVACY_PURPOSES, events: [], source: "fallback" };
  }

  const [{ data: purposes, error: purposeError }, { data: events, error: eventError }] = await Promise.all([
    client.from("privacy_purposes").select("*").order("purpose_code").order("version", { ascending: false }),
    client.from("privacy_consent_events").select("id,purpose_code,purpose_version,event_type,source,proof,created_at").order("created_at", { ascending: false }),
  ]);
  throwIfError(purposeError);
  throwIfError(eventError);
  return { purposes: sortPurposes(purposes?.length ? purposes : PRIVACY_PURPOSES), events: events ?? [], source: "supabase" };
}

export async function loadPrivacyPreferences(userIdOrOptions) {
  const { userId, forceRefresh } = parseLoadPrivacyOptions(userIdOrOptions);
  const cacheKey = userId || null;

  if (cacheKey && !forceRefresh) {
    const cached = peekPrivacyPreferencesCache(cacheKey);
    if (cached) return cached;
    const inflight = privacyPreferencesInflight.get(cacheKey);
    if (inflight) return inflight;
  }

  const request = fetchPrivacyPreferences().then((data) => {
    if (cacheKey) {
      privacyPreferencesCache.set(cacheKey, { data, fetchedAt: Date.now() });
    }
    return data;
  });

  if (cacheKey) privacyPreferencesInflight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    if (cacheKey && privacyPreferencesInflight.get(cacheKey) === request) {
      privacyPreferencesInflight.delete(cacheKey);
    }
  }
}

export async function savePrivacyDecision({ purposeCode, eventType, source = "preferences" }) {
  const client = clientOrThrow();
  const { data, error } = await client.rpc("record_privacy_event", {
    p_purpose_code: purposeCode,
    p_event_type: eventType,
    p_source: source,
  });
  throwIfError(error);
  invalidatePrivacyPreferencesCache();
  return data;
}

export async function recordPrivacyNotice(purposeCode) {
  return savePrivacyDecision({ purposeCode, eventType: "notice" });
}

export async function saveOptionalChoice(purposeCode, accepted) {
  return savePrivacyDecision({ purposeCode, eventType: accepted ? "accepted" : "refused" });
}

export async function revokePurpose(purposeCode) {
  return savePrivacyDecision({ purposeCode, eventType: "revoked" });
}

export function groupCurrentPrivacyEvents(events) {
  return latestEventsByPurpose([...events].sort((left, right) => new Date(right.created_at) - new Date(left.created_at)));
}
