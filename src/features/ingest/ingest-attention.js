import { latestIngestionAttempt } from "./ingestion-attempt.js";

/**
 * Predicado único “ingestão precisa atenção”.
 * Contrato: docs-local/tech/INGEST-ATTENTION-CONTRACT.md
 * Igual ao WHERE de count_job_ingestions_needing_attention.
 */
export function needsAttention({ jobId = null, latestOutcome = null } = {}) {
  if (!latestOutcome) return !jobId;
  return latestOutcome === "failed" || latestOutcome === "expired";
}

/** Adapta o objeto de ingestão (tentativas) ao predicado. */
export function ingestNeedsAttention(ingestion) {
  const attempt = latestIngestionAttempt(ingestion);
  return needsAttention({
    jobId: ingestion?.job_id ?? null,
    latestOutcome: attempt?.outcome ?? null,
  });
}

/** Adapta uma linha de job_ingestion_staff_list ao predicado. */
export function staffListRowNeedsAttention(row) {
  return needsAttention({
    jobId: row?.job_id ?? null,
    latestOutcome: row?.latest_outcome ?? null,
  });
}
