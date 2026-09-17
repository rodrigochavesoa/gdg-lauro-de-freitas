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

const SCHEMA_UNAVAILABLE_CODES = new Set(["PGRST205", "PGRST202", "42P01", "42883", "404"]);
const SCHEMA_UNAVAILABLE_MESSAGE = "Preferências temporariamente indisponíveis.";

let privacySchemaUnavailable = false;
let privacySchemaUnavailableReported = false;

export function isPrivacySchemaUnavailableError(error) {
  if (!error) return false;
  const code = String(error.code ?? error.status ?? "");
  if (SCHEMA_UNAVAILABLE_CODES.has(code)) return true;
  const text = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return (
    text.includes("does not exist") ||
    text.includes("schema cache") ||
    text.includes("could not find the table") ||
    text.includes("could not find the function")
  );
}

function markPrivacySchemaUnavailable() {
  privacySchemaUnavailable = true;
  if (privacySchemaUnavailableReported) return;
  privacySchemaUnavailableReported = true;
  console.info({ event: "privacy_schema_unavailable" });
}

function schemaUnavailablePayload() {
  markPrivacySchemaUnavailable();
  return { available: false, source: "schema-unavailable", purposes: [], events: [] };
}

function throwIfError(error) {
  if (!error) return;
  if (isPrivacySchemaUnavailableError(error)) {
    markPrivacySchemaUnavailable();
    throw new Error(SCHEMA_UNAVAILABLE_MESSAGE);
  }
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
  privacySchemaUnavailable = false;
  privacySchemaUnavailableReported = false;
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
    return { available: true, purposes: PRIVACY_PURPOSES, events: [], source: "fallback" };
  }

  const [{ data: purposes, error: purposeError }, { data: events, error: eventError }] = await Promise.all([
    client.from("privacy_purposes").select("*").order("purpose_code").order("version", { ascending: false }),
    client.from("privacy_consent_events").select("id,purpose_code,purpose_version,event_type,source,proof,created_at").order("created_at", { ascending: false }),
  ]);
  if (isPrivacySchemaUnavailableError(purposeError) || isPrivacySchemaUnavailableError(eventError)) {
    return schemaUnavailablePayload();
  }
  throwIfError(purposeError);
  throwIfError(eventError);
  return {
    available: true,
    purposes: sortPurposes(purposes?.length ? purposes : PRIVACY_PURPOSES),
    events: events ?? [],
    source: "supabase",
  };
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
    if (cacheKey && data.source !== "schema-unavailable") {
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
  if (privacySchemaUnavailable) {
    throw new Error(SCHEMA_UNAVAILABLE_MESSAGE);
  }
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
