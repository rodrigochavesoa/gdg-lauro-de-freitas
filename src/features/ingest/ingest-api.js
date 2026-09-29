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
import { mapIngestionDetailRowToDto, mapIngestionListRowToDto } from "../../lib/data-contracts/map-row.js";
import { INGESTION_DETAIL_SELECT, INGESTION_LIST_SELECT } from "../../lib/data-contracts/selects.js";
import { classifyIngestionResult, runObserved } from "../../lib/ops-observability.js";
import { throwStaffApiError } from "../../lib/staff-api-errors.js";
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

export { latestIngestionAttempt } from "./ingestion-attempt.js";

function clientOrThrow(client) {
  const resolved = client ?? getSupabaseBrowserClient();
  if (!resolved?.rpc) {
    throw new Error("cliente de ingestão ausente.");
  }
  return resolved;
}

function throwIfError(error) {
  throwStaffApiError(error);
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

export const INGESTION_PAGE_SIZE = 24;

function normalizePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function mapIngestionListRow(row) {
  return mapIngestionListRowToDto(row);
}

/** Página enxuta. Payload e tentativas ficam em loadJobIngestionDetail. */
export async function loadJobIngestions(client, { page = 1, pageSize = INGESTION_PAGE_SIZE } = {}) {
  const resolved = clientOrThrow(client);
  const safePage = normalizePositiveInt(page, 1);
  const safePageSize = Math.min(normalizePositiveInt(pageSize, INGESTION_PAGE_SIZE), INGESTION_PAGE_SIZE);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize;
  const { data, error } = await resolved
    .from("job_ingestion_staff_list")
    .select(INGESTION_LIST_SELECT)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  throwIfError(error);
  const rows = data ?? [];
  const hasNext = rows.length > safePageSize;
  return {
    items: (hasNext ? rows.slice(0, safePageSize) : rows).map(mapIngestionListRow),
    page: safePage,
    pageSize: safePageSize,
    hasNext,
  };
}

export async function loadJobIngestionDetail(client, id) {
  if (!id) throw new Error("Ingestão para detalhe não informada.");
  const resolved = clientOrThrow(client);
  const { data, error } = await resolved
    .from("job_ingestions")
    .select(INGESTION_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();
  throwIfError(error);
  return data ? mapIngestionDetailRowToDto(data) : null;
}

export { REGISTER_JOB_INGESTION_RPC, isIngestionExpired };
