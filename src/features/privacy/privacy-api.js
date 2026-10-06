import { createMemoryCache } from "../../lib/client-cache/store.js";
import { LIST_CACHE_TTL_MS } from "../../lib/client-cache/ttl.js";
import { getSupabaseBrowserClient } from "../../lib/supabase-client.js";
import { mapPrivacyPurposeRowToDto } from "../../lib/data-contracts/map-row.js";
import { PRIVACY_EVENT_SELECT, PRIVACY_PURPOSE_SELECT } from "../../lib/data-contracts/selects.js";
import { redactForLog } from "../../lib/privacy-redaction.js";
import { PRIVACY_PURPOSES, latestEventsByPurpose } from "./privacy-catalog.js";

export const PRIVACY_PREFERENCES_CACHE_TTL_MS = LIST_CACHE_TTL_MS;

const privacyPreferencesCache = createMemoryCache({
  ttlMs: PRIVACY_PREFERENCES_CACHE_TTL_MS,
  name: "privacy",
});

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
  const latestByCode = new Map();
  for (const purpose of rows) {
    const current = latestByCode.get(purpose.purpose_code);
    if (!current || Number(purpose.version) > Number(current.version)) {
      latestByCode.set(purpose.purpose_code, purpose);
    }
  }
  return [...latestByCode.values()].sort((left, right) => left.purpose_code.localeCompare(right.purpose_code));
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
    privacyPreferencesCache.invalidateKey(userId);
    return;
  }
  privacyPreferencesCache.clear();
  privacySchemaUnavailable = false;
  privacySchemaUnavailableReported = false;
}

export function peekPrivacyPreferencesCache(userId) {
  if (!userId) return null;
  return privacyPreferencesCache.peek(userId);
}

async function fetchPrivacyPreferences() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return { available: true, purposes: PRIVACY_PURPOSES, events: [], source: "fallback" };
  }

  const [{ data: purposes, error: purposeError }, { data: events, error: eventError }] = await Promise.all([
    client.from("privacy_purposes").select(PRIVACY_PURPOSE_SELECT).order("purpose_code").order("version", { ascending: false }),
    client.from("privacy_consent_events").select(PRIVACY_EVENT_SELECT).order("created_at", { ascending: false }),
  ]);
  if (isPrivacySchemaUnavailableError(purposeError) || isPrivacySchemaUnavailableError(eventError)) {
    return schemaUnavailablePayload();
  }
  throwIfError(purposeError);
  throwIfError(eventError);
  return {
    available: true,
    purposes: sortPurposes(purposes?.length ? purposes.map(mapPrivacyPurposeRowToDto) : PRIVACY_PURPOSES),
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
    const inflight = privacyPreferencesCache.inflightGet(cacheKey);
    if (inflight) return inflight;
  }
  if (cacheKey && forceRefresh) privacyPreferencesCache.supersede(cacheKey);
  const writeEpoch = cacheKey ? privacyPreferencesCache.capture(cacheKey) : null;

  const request = fetchPrivacyPreferences().then((data) => {
    if (cacheKey && data.source !== "schema-unavailable") {
      privacyPreferencesCache.set(cacheKey, data, writeEpoch);
    }
    return data;
  });

  if (cacheKey) privacyPreferencesCache.inflightSet(cacheKey, request);
  try {
    return await request;
  } finally {
    if (cacheKey) privacyPreferencesCache.inflightDelete(cacheKey, request);
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
