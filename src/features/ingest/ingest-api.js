/**
 * MVP-013 Fase B — processar ingestão controlada (manual/fixture).
 * Encaminha para curadoria pending. Nunca escolhe approved.
 */

import {
  REGISTER_JOB_INGESTION_RPC,
  SOURCE_KINDS,
  pickIngestionPayload,
  normalizeLocator,
  isIngestionExpired,
} from "./source-contract.js";
import { classifyIngestionResult, runObserved } from "../../lib/ops-observability.js";
import { formatStaffPrivilegedApiError } from "../auth/staff-mfa.js";
import { getSupabaseBrowserClient } from "../../lib/supabase-client.js";

export const PROCESS_JOB_INGESTION_RPC = "process_job_ingestion";

export const INGESTION_OUTCOMES = Object.freeze({
  MATERIALIZED: "materialized",
  IDEMPOTENT: "idempotent",
  FAILED: "failed",
  EXPIRED: "expired",
  DUPLICATE_010: "duplicate_010",
});

export const INGESTION_FAILURE_CODES = Object.freeze({
  EXPIRED: "expired",
  PAYLOAD_INVALID: "payload_invalid",
  DUPLICATE_010: "duplicate_010",
  MATERIALIZE_FAILED: "materialize_failed",
});

const OUTCOME_LABEL = {
  materialized: "Vaga pendente de curadoria",
  idempotent: "Já processada (idempotente)",
  failed: "Falha redigida",
  expired: "Expirada",
  duplicate_010: "Duplicata 010 reaproveitada",
};

export const HOMOLOG_MANUAL_FIXTURE = Object.freeze({
  sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
  locator: "fixture:homolog-acme-frontend",
  payload: Object.freeze({
    title: "Pessoa Dev Front-end (fixture homolog)",
    company_name: "Empresa Fictícia Lab",
    description: "Vaga fictícia de homologação da ingestão controlada. Sem dados pessoais.",
    level: "junior",
    work_model: "remote",
    location: "Brasil · Remoto",
    stack: Object.freeze(["React", "TypeScript"]),
  }),
});

/** País e faixa explícitos. A localidade não é a fonte do country_code. */
export const HOMOLOG_STRUCTURED_FIXTURE = Object.freeze({
  sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
  locator: "fixture:homolog-acme-frontend-structured",
  payload: Object.freeze({
    title: "Pessoa Dev Front-end (fixture estruturada)",
    company_name: "Empresa Fictícia Lab",
    description: "Vaga fictícia com país e faixa informados na origem. Sem dados pessoais.",
    level: "junior",
    work_model: "remote",
    location: "Salvador · BA",
    country_code: "BR",
    salary_min: 800000,
    salary_max: 1200000,
    stack: Object.freeze(["React", "TypeScript"]),
  }),
});

export function describeIngestionOutcome(outcome) {
  return OUTCOME_LABEL[outcome] ?? "Estado desconhecido";
}

export function latestIngestionAttempt(ingestion) {
  const attempts = Array.isArray(ingestion?.job_ingestion_attempts)
    ? ingestion.job_ingestion_attempts
    : [];
  if (attempts.length === 0) return null;
  return [...attempts].sort((left, right) => {
    const leftAt = Date.parse(left?.created_at ?? "") || 0;
    const rightAt = Date.parse(right?.created_at ?? "") || 0;
    return rightAt - leftAt;
  })[0];
}

function clientOrThrow(client) {
  const resolved = client ?? getSupabaseBrowserClient();
  if (!resolved?.rpc) {
    throw new Error("cliente de ingestão ausente.");
  }
  return resolved;
}

function throwIfError(error) {
  if (error) {
    const mapped = formatStaffPrivilegedApiError(error.message);
    throw new Error(mapped || error.message || "Falha na API de ingestão.");
  }
}

export async function processJobIngestion(client, { sourceKind, locator, payload, expiresAt } = {}) {
  return runObserved(
    {
      flow: "ingestion",
      action: "process_job_ingestion",
      route: "/admin/ingestao",
      classifyResult: classifyIngestionResult,
    },
    async () => {
      const resolved = clientOrThrow(client);
      normalizeLocator(sourceKind, locator);
      pickIngestionPayload(payload);
      const { data, error } = await resolved.rpc(PROCESS_JOB_INGESTION_RPC, {
        p_source_kind: String(sourceKind ?? "").trim().toLowerCase(),
        p_locator: locator,
        p_payload: payload,
        p_expires_at: expiresAt ?? null,
      });
      throwIfError(error);
      const row = data && typeof data === "object" && !Array.isArray(data) ? data : {};
      if (!row.ingestion?.id) {
        throw new Error("RPC process_job_ingestion não devolveu a ingestão.");
      }
      return row;
    },
  );
}

/** Lista completa para homolog/fixture. Sem limite — follow-up INGEST-LIST-PAGE-01 antes de uso operacional maior. */
export async function loadJobIngestions(client) {
  const resolved = clientOrThrow(client);
  const { data, error } = await resolved
    .from("job_ingestions")
    .select(
      "id,source_kind,normalized_locator,payload_hash,expires_at,job_id,created_at,canonical_payload,jobs(id,title,status),job_ingestion_attempts(id,outcome,failure_code,failure_detail,job_id,created_at)",
    )
    .order("created_at", { ascending: false });
  throwIfError(error);
  return data ?? [];
}

export { REGISTER_JOB_INGESTION_RPC, isIngestionExpired };
