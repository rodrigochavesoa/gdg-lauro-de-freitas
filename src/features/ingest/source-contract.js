/**
 * MVP-013 Fase A — contrato de origem e fingerprint.
 * Camada independente de MVP-010 (`company_id` + título normalizado em `jobs`).
 * Não materializa vaga, não altera curadoria e não escolhe `approved`.
 */

import { runObserved } from "../../lib/ops-observability.js";

export const SOURCE_KINDS = Object.freeze({
  MANUAL_FIXTURE: "manual_fixture",
  STAFF_REPLAY: "staff_replay",
});

export const SOURCE_KIND_VALUES = Object.freeze([
  SOURCE_KINDS.MANUAL_FIXTURE,
  SOURCE_KINDS.STAFF_REPLAY,
]);

export const NORMALIZED_LOCATOR_MAX_LENGTH = 2048;

/** Campos que entram no hash. Qualquer outra chave é ignorada no canônico. */
export const INGESTION_PAYLOAD_KEYS = Object.freeze([
  "company_name",
  "description",
  "level",
  "location",
  "stack",
  "title",
  "work_model",
]);

/** Campos de titular/segredo que o contrato recusa no payload de origem. */
export const INGESTION_FORBIDDEN_PAYLOAD_KEYS = Object.freeze([
  "access_token",
  "authorization",
  "bio",
  "curriculum",
  "cv",
  "cv_url",
  "email",
  "full_name",
  "password",
  "prompt",
  "resume",
  "secret",
  "token",
]);

const TRACKING_QUERY_PARAM = /^(utm_|fbclid$|gclid$|mc_eid$)/i;

export function isSupportedSourceKind(sourceKind) {
  return SOURCE_KIND_VALUES.includes(String(sourceKind ?? "").trim().toLowerCase());
}

export function normalizeSlugLocator(rawLocator) {
  const normalized = String(rawLocator ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (!normalized) {
    throw new Error("normalized_locator vazio após normalização.");
  }
  if (normalized.length > NORMALIZED_LOCATOR_MAX_LENGTH) {
    throw new Error("normalized_locator excede 2048 caracteres.");
  }
  return normalized;
}

/**
 * Regras reservadas para source_kind HTTP futuro (fora desta sprint).
 * Strip de credencial, fragmento, porta default, barra final e params de tracking.
 */
export function normalizeUrlLocator(rawLocator) {
  const trimmed = String(rawLocator ?? "").trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("localizador URL inválido.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("localizador URL exige http ou https.");
  }
  parsed.username = "";
  parsed.password = "";
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  if (
    (parsed.protocol === "http:" && parsed.port === "80") ||
    (parsed.protocol === "https:" && parsed.port === "443")
  ) {
    parsed.port = "";
  }
  if (parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }
  const kept = [...parsed.searchParams.entries()]
    .filter(([key]) => !TRACKING_QUERY_PARAM.test(key))
    .sort(
      ([leftKey, leftValue], [rightKey, rightValue]) =>
        leftKey.localeCompare(rightKey) || String(leftValue).localeCompare(String(rightValue)),
    );
  parsed.search = "";
  for (const [key, value] of kept) {
    parsed.searchParams.append(key, value);
  }
  const normalized = parsed.toString();
  if (normalized.length > NORMALIZED_LOCATOR_MAX_LENGTH) {
    throw new Error("normalized_locator excede 2048 caracteres.");
  }
  return normalized;
}

export function normalizeLocator(sourceKind, rawLocator) {
  const kind = String(sourceKind ?? "").trim().toLowerCase();
  if (!isSupportedSourceKind(kind)) {
    throw new Error(`source_kind não suportado nesta camada: ${kind || "(vazio)"}`);
  }
  return normalizeSlugLocator(rawLocator);
}

export function assertIngestionPayloadSafe(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("payload de ingestão inválido.");
  }
  const hits = Object.keys(payload).filter((key) => INGESTION_FORBIDDEN_PAYLOAD_KEYS.includes(key));
  if (hits.length > 0) {
    throw new Error(`payload de ingestão contém campos proibidos: ${hits.join(", ")}`);
  }
  return payload;
}

function normalizePayloadString(value) {
  const text = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  return text || undefined;
}

export function pickIngestionPayload(payload) {
  assertIngestionPayloadSafe(payload);
  const picked = {};
  for (const key of INGESTION_PAYLOAD_KEYS) {
    const value = payload[key];
    if (value == null) continue;
    if (key === "stack") {
      const stack = Array.isArray(value)
        ? [...value]
            .map((item) => String(item).trim())
            .filter(Boolean)
            .sort((left, right) => left.localeCompare(right))
        : [];
      if (stack.length > 0) picked.stack = stack;
      continue;
    }
    if (typeof value === "string") {
      const text = normalizePayloadString(value);
      if (text) picked[key] = text;
      continue;
    }
    picked[key] = value;
  }
  if (!picked.title || !picked.company_name) {
    throw new Error("payload de ingestão exige title e company_name.");
  }
  return picked;
}

export function canonicalizeIngestionPayload(payload) {
  return JSON.stringify(pickIngestionPayload(payload));
}

function bytesToHex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const REGISTER_JOB_INGESTION_RPC = "register_job_ingestion";

/**
 * SHA-256 hex do payload canônico (preview/teste).
 * Persistência usa `register_job_ingestion`, que recalcula o digest no banco
 * (`private.hash_job_ingestion_payload`) e ignora qualquer hash enviado pelo cliente.
 */
export async function hashIngestionPayload(payload) {
  const canonical = canonicalizeIngestionPayload(payload);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return bytesToHex(digest);
}

export async function buildIngestionFingerprint({ sourceKind, locator, payload }) {
  const source_kind = String(sourceKind ?? "").trim().toLowerCase();
  const normalized_locator = normalizeLocator(source_kind, locator);
  const payload_hash = await hashIngestionPayload(payload);
  return { source_kind, normalized_locator, payload_hash };
}

export function isSameIngestionFingerprint(left, right) {
  return (
    left?.source_kind === right?.source_kind &&
    left?.normalized_locator === right?.normalized_locator &&
    left?.payload_hash === right?.payload_hash
  );
}

export function isIngestionExpired(expiresAt, now = new Date()) {
  if (expiresAt == null || expiresAt === "") return false;
  const when = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(when.getTime())) return false;
  return when.getTime() <= now.getTime();
}

export const INGESTION_FINGERPRINT_CONSTRAINT = "job_ingestions_source_fingerprint_key";

export function isIngestionUniqueViolation(error) {
  if (error?.code !== "23505") return false;
  const text = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ");
  return new RegExp(INGESTION_FINGERPRINT_CONSTRAINT, "i").test(text);
}

/**
 * Registro idempotente na camada 013 via RPC. O banco recalcula `payload_hash`.
 * Não cria `jobs` e não altera status de curadoria.
 */
export async function registerJobIngestion(client, { sourceKind, locator, payload, expiresAt, jobId } = {}) {
  return runObserved(
    { flow: "ingestion", action: "register_job_ingestion", route: "/admin/ingestao" },
    async () => {
      if (!client?.rpc) {
        throw new Error("cliente de ingestão ausente.");
      }
      normalizeLocator(sourceKind, locator);
      pickIngestionPayload(payload);
      const { data, error } = await client.rpc(REGISTER_JOB_INGESTION_RPC, {
        p_source_kind: String(sourceKind ?? "").trim().toLowerCase(),
        p_locator: locator,
        p_payload: payload,
        p_expires_at: expiresAt ?? null,
        p_job_id: jobId ?? null,
      });
      if (error) {
        throw new Error(error.message || "Falha ao registrar ingestão.");
      }
      const row = data && typeof data === "object" && !Array.isArray(data) ? data : {};
      if (!row.id) {
        throw new Error("RPC register_job_ingestion não devolveu a linha.");
      }
      return { ...row, idempotent: Boolean(row.idempotent) };
    },
  );
}
