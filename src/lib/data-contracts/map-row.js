/** Mensagem estável para teste e para quem está desenvolvendo. Não é copy de UI. */
export function contractError(surface, field) {
  if (field) return `contrato de dados: campo obrigatório ausente (${surface}.${field})`;
  return `contrato de dados: linha ausente (${surface})`;
}

/**
 * Exige as chaves do select. Null é valor; chave ausente é drift de contrato.
 * @param {object} row
 * @param {string[]} fields
 * @param {string} surface
 */
export function requireRowFields(row, fields, surface) {
  if (row == null || typeof row !== "object" || Array.isArray(row)) {
    throw new Error(contractError(surface));
  }
  for (const field of fields) {
    if (!Object.hasOwn(row, field)) {
      throw new Error(contractError(surface, field));
    }
  }
  return row;
}

export function selectIdentifiers(select) {
  return String(select).match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
}

export function mapCatalogListRowToDto(row) {
  return requireRowFields(row, ["id", "title", "status"], "catalog.list");
}

export function mapCatalogDetailRowToDto(row) {
  return requireRowFields(row, ["id", "title"], "catalog.detail");
}

export function mapCatalogHeavyRowToDto(row) {
  return requireRowFields(row, ["id"], "catalog.detail.heavy");
}

export function mapAdminJobListRowToDto(row) {
  requireRowFields(row, ["id", "title", "status"], "admin.jobs.list");
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    created_at: row.created_at,
    level: row.level,
    work_model: row.work_model,
    companies: row.companies ?? null,
  };
}

export function mapAdminJobFormRowToDto(row) {
  return requireRowFields(row, ["id", "title", "status"], "admin.jobs.form");
}

export function mapCurationListRowToDto(row) {
  return requireRowFields(row, ["id", "title", "status"], "curation.list");
}

export function mapCurationDetailRowToDto(row) {
  return requireRowFields(row, ["id"], "curation.detail");
}

export function mapIngestionListRowToDto(row) {
  const source = requireRowFields(
    row,
    ["id", "source_kind", "normalized_locator", "created_at"],
    "ingest.list",
  );
  const jobId = source.job_id ?? null;
  const title = source.job_title ?? null;
  const status = source.job_status ?? null;
  return {
    id: source.id,
    source_kind: source.source_kind,
    normalized_locator: source.normalized_locator,
    expires_at: source.expires_at ?? null,
    job_id: jobId,
    created_at: source.created_at,
    payload_title: source.payload_title ?? null,
    latest_outcome: source.latest_outcome ?? null,
    jobs: jobId || title || status ? { id: jobId, title, status } : null,
  };
}

export function mapApplicationListRowToDto(row) {
  return requireRowFields(row, ["id", "job_id", "status"], "applications.list");
}

export function mapProfileRowToDto(row) {
  return requireRowFields(row, ["id"], "profile");
}

export function mapPrivacyPurposeRowToDto(row) {
  return requireRowFields(row, ["purpose_code", "version", "title"], "privacy.purpose");
}
