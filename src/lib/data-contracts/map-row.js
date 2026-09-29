/** Mensagem estável para teste e para quem está desenvolvendo. Não é copy de UI. */
export function contractError(surface, field) {
  if (field) return `contrato de dados: campo obrigatório ausente (${surface}.${field})`;
  return `contrato de dados: linha ausente (${surface})`;
}

/**
 * Exige as chaves do contrato. Null é valor; chave ausente é drift.
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

function projectColumns(row, columns, required, surface) {
  requireRowFields(row, required, surface);
  const dto = {};
  for (const field of columns) {
    if (Object.hasOwn(row, field)) dto[field] = row[field];
  }
  return dto;
}

function asEmbed(value) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

function projectEmbed(value, columns) {
  const source = asEmbed(value);
  if (!source) return null;
  const dto = {};
  for (const field of columns) {
    if (Object.hasOwn(source, field)) dto[field] = source[field];
  }
  return dto;
}

function projectEmbedList(value, columns, required, surface) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error(contractError(surface));
  return value.map((item, index) => projectColumns(item, columns, required, `${surface}[${index}]`));
}

const CATALOG_LIST_COLUMNS = [
  "id",
  "title",
  "stack",
  "level",
  "work_model",
  "location",
  "country_code",
  "salary_min",
  "salary_max",
  "salary_currency",
  "status",
  "approved_at",
  "created_at",
];

const COMPANY_NAME = ["name"];
const COMPANY_DETAIL = ["name", "description"];

export function mapCatalogListRowToDto(row) {
  const dto = projectColumns(row, CATALOG_LIST_COLUMNS, ["id", "title", "status"], "catalog.list");
  dto.companies = projectEmbed(row.companies, COMPANY_NAME);
  return dto;
}

export function mapCatalogDetailRowToDto(row) {
  const dto = projectColumns(
    row,
    [...CATALOG_LIST_COLUMNS, "description", "requirements"],
    ["id", "title", "description", "requirements"],
    "catalog.detail",
  );
  dto.companies = projectEmbed(row.companies, COMPANY_DETAIL);
  return dto;
}

export function mapCatalogHeavyRowToDto(row) {
  const dto = projectColumns(
    row,
    ["id", "description", "requirements"],
    ["id", "description", "requirements"],
    "catalog.detail.heavy",
  );
  dto.companies = projectEmbed(row.companies, ["description"]);
  return dto;
}

const ADMIN_LIST_COLUMNS = ["id", "title", "status", "created_at", "level", "work_model"];

export function mapAdminJobListRowToDto(row) {
  const dto = projectColumns(row, ADMIN_LIST_COLUMNS, ["id", "title", "status"], "admin.jobs.list");
  dto.companies = projectEmbed(row.companies, COMPANY_NAME);
  return dto;
}

const ADMIN_REVIEW_COLUMNS = ["decision", "rubric_code", "internal_comment", "curation_round", "created_at"];

const ADMIN_FORM_COLUMNS = [
  "id",
  "title",
  "status",
  "company_id",
  "level",
  "work_model",
  "location",
  "country_code",
  "salary_min",
  "salary_max",
  "description",
  "stack",
  "curation_round",
  "rejected_at",
];

export function mapAdminJobFormRowToDto(row) {
  const dto = projectColumns(row, ADMIN_FORM_COLUMNS, ["id", "title", "status", "description"], "admin.jobs.form");
  dto.companies = projectEmbed(row.companies, COMPANY_NAME);
  dto.job_curation_reviews = projectEmbedList(
    row.job_curation_reviews,
    ADMIN_REVIEW_COLUMNS,
    ["decision"],
    "admin.jobs.form.job_curation_reviews",
  );
  return dto;
}

const CURATION_LIST_COLUMNS = [
  "id",
  "title",
  "status",
  "priority",
  "curation_round",
  "level",
  "work_model",
  "location",
  "created_at",
];

export function mapCurationListRowToDto(row) {
  const dto = projectColumns(row, CURATION_LIST_COLUMNS, ["id", "title", "status"], "curation.list");
  dto.companies = projectEmbed(row.companies, COMPANY_NAME);
  return dto;
}

export function mapCurationDetailRowToDto(row) {
  return projectColumns(row, ["id", "description", "stack"], ["id", "description"], "curation.detail");
}

const CURATION_REVIEW_COLUMNS = ["job_id", "curation_round", "reviewer_id", ...ADMIN_REVIEW_COLUMNS];

export function mapCurationReviewRowToDto(row) {
  return projectColumns(row, CURATION_REVIEW_COLUMNS, ["job_id", "decision"], "curation.review");
}

export function mapIngestionListRowToDto(row) {
  const source = projectColumns(
    row,
    [
      "id",
      "source_kind",
      "normalized_locator",
      "expires_at",
      "job_id",
      "created_at",
      "payload_title",
      "job_title",
      "job_status",
      "latest_outcome",
    ],
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

const ATTEMPT_COLUMNS = ["id", "outcome", "failure_code", "failure_detail", "job_id", "created_at"];

export function mapIngestionDetailRowToDto(row) {
  const dto = projectColumns(
    row,
    [
      "id",
      "source_kind",
      "normalized_locator",
      "payload_hash",
      "expires_at",
      "job_id",
      "created_at",
      "canonical_payload",
    ],
    ["id", "canonical_payload"],
    "ingest.detail",
  );
  dto.jobs = projectEmbed(row.jobs, ["id", "title", "status"]);
  dto.job_ingestion_attempts = projectEmbedList(
    row.job_ingestion_attempts,
    ATTEMPT_COLUMNS,
    ["id", "outcome"],
    "ingest.detail.job_ingestion_attempts",
  );
  return dto;
}

const APPLICATION_LIST_COLUMNS = ["id", "job_id", "candidate_id", "status", "created_at", "updated_at"];

export function mapApplicationListRowToDto(row) {
  const dto = projectColumns(row, APPLICATION_LIST_COLUMNS, ["id", "job_id", "status"], "applications.list");
  const jobs = projectEmbed(row.jobs, ["title"]);
  dto.jobs = jobs
    ? { title: jobs.title, companies: projectEmbed(asEmbed(row.jobs)?.companies, COMPANY_NAME) }
    : null;
  return dto;
}

export function mapApplicationDetailRowToDto(row) {
  return projectColumns(
    row,
    [...APPLICATION_LIST_COLUMNS, "snapshot"],
    ["id", "job_id", "status", "snapshot"],
    "applications.detail",
  );
}

export function mapProfileRowToDto(row) {
  return projectColumns(
    row,
    ["id", "full_name", "headline", "bio", "skills", "preferences", "role", "avatar_path"],
    ["id"],
    "profile",
  );
}

export function mapPrivacyPurposeRowToDto(row) {
  return projectColumns(
    row,
    [
      "purpose_code",
      "version",
      "title",
      "specific_description",
      "classification",
      "status",
      "legal_basis_status",
      "retention_status",
      "text_status",
      "revocation_effect",
      "created_at",
    ],
    ["purpose_code", "version", "title"],
    "privacy.purpose",
  );
}
