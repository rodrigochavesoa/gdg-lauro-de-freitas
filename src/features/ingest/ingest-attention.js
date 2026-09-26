import { latestIngestionAttempt } from "./ingest-api.js";

/**
 * Predicado “ingestão precisa atenção”.
 * Contrato: docs-local/tech/INGEST-ATTENTION-CONTRACT.md
 * Igual ao WHERE de count_job_ingestions_needing_attention. Não alterar sem o checklist.
 */
export function ingestNeedsAttention(ingestion) {
  const attempt = latestIngestionAttempt(ingestion);
  if (!attempt) return !ingestion?.job_id;
  return attempt.outcome === "failed" || attempt.outcome === "expired";
}

/**
 * Mesmo predicado sobre uma linha de job_ingestion_staff_list.
 * Contrato: docs-local/tech/INGEST-ATTENTION-CONTRACT.md
 */
export function staffListRowNeedsAttention(row) {
  const outcome = row?.latest_outcome ?? null;
  if (!outcome) return !row?.job_id;
  return outcome === "failed" || outcome === "expired";
}
