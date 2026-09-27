/**
 * Última tentativa, na mesma ordem da view job_ingestion_staff_list:
 * created_at desc, id desc.
 * Contrato: docs-local/tech/INGEST-ATTENTION-CONTRACT.md
 */
export function latestIngestionAttempt(ingestion) {
  const attempts = Array.isArray(ingestion?.job_ingestion_attempts)
    ? ingestion.job_ingestion_attempts
    : [];
  if (attempts.length === 0) return null;
  return [...attempts].sort((left, right) => {
    const leftAt = Date.parse(left?.created_at ?? "") || 0;
    const rightAt = Date.parse(right?.created_at ?? "") || 0;
    if (leftAt !== rightAt) return rightAt - leftAt;
    const leftId = String(left?.id ?? "");
    const rightId = String(right?.id ?? "");
    if (leftId === rightId) return 0;
    return leftId < rightId ? 1 : -1;
  })[0];
}
