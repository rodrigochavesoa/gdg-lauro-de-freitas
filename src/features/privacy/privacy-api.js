import { getSupabaseBrowserClient } from "../../lib/supabase-client.js";
import { redactForLog } from "../../lib/privacy-redaction.js";
import { PRIVACY_PURPOSES, latestEventsByPurpose } from "./privacy-catalog.js";

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

export async function loadPrivacyPreferences() {
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

export async function savePrivacyDecision({ purposeCode, eventType, source = "preferences" }) {
  const client = clientOrThrow();
  const { data, error } = await client.rpc("record_privacy_event", {
    p_purpose_code: purposeCode,
    p_event_type: eventType,
    p_source: source,
  });
  throwIfError(error);
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
