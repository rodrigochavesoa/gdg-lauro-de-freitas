/**
 * Seletores PostgREST por superfície. Listas não trazem texto longo, payload nem PII de detalhe.
 * A matriz humana está em docs/tech/DATA-CONTRACTS.md.
 */

export const JOB_DETAIL_SELECT = `
  id,
  title,
  description,
  requirements,
  stack,
  level,
  work_model,
  location,
  country_code,
  salary_min,
  salary_max,
  salary_currency,
  status,
  approved_at,
  created_at,
  companies ( name, description )
`;

/** UX-PERF-04 — only fields missing from JOB_LIST_SELECT / list mapJob. */
export const JOB_DETAIL_HEAVY_SELECT = `
  id,
  description,
  requirements,
  companies ( description )
`;

export const JOB_LIST_SELECT = `
  id,
  title,
  stack,
  level,
  work_model,
  location,
  country_code,
  salary_min,
  salary_max,
  salary_currency,
  status,
  approved_at,
  created_at,
  companies ( name )
`;

/** Empty embed `co` + display embed — PostgREST OR across company needs co.not.is.null, not companies.name inside .or(). */
export const JOB_LIST_SELECT_SEARCH = `
  id,
  title,
  stack,
  level,
  work_model,
  location,
  country_code,
  salary_min,
  salary_max,
  salary_currency,
  status,
  approved_at,
  created_at,
  co:companies(),
  companies ( name )
`;

export const ADMIN_JOB_LIST_SELECT = "id,title,status,created_at,level,work_model,companies(name)";
export const ADMIN_JOB_LIST_SELECT_SEARCH =
  "id,title,status,created_at,level,work_model,co:companies(),companies(name)";

export const ADMIN_JOB_SELECT =
  "id,title,status,company_id,level,work_model,location,country_code,salary_min,salary_max,description,stack,curation_round,rejected_at,companies(name),job_curation_reviews(decision,rubric_code,internal_comment,curation_round,created_at)";

export const ADMIN_JOB_TITLE_PROBE_SELECT = "id,title,company_id";
export const COMPANY_PICKER_SELECT = "id,name";

export const CURATION_LIST_FIELDS =
  "id,title,status,priority,curation_round,level,work_model,location,created_at,companies(name)";
export const CURATION_DETAIL_FIELDS = "id,description,stack";
export const CURATION_REVIEW_FIELDS =
  "job_id,curation_round,reviewer_id,decision,rubric_code,internal_comment,created_at";
export const CURATION_MODERATION_ID_SELECT = "id";

export const INGESTION_LIST_SELECT =
  "id,source_kind,normalized_locator,expires_at,job_id,created_at,payload_title,job_title,job_status,latest_outcome";
export const INGESTION_DETAIL_SELECT =
  "id,source_kind,normalized_locator,payload_hash,expires_at,job_id,created_at,canonical_payload,jobs(id,title,status),job_ingestion_attempts(id,outcome,failure_code,failure_detail,job_id,created_at)";

export const APPLICATION_SELECT = "id,job_id,candidate_id,status,snapshot,created_at,updated_at";
/** Lista: sem snapshot (a UI não renderiza). Detalhe/RPC continua com APPLICATION_SELECT. */
export const APPLICATION_LIST_SELECT = "id,job_id,candidate_id,status,created_at,updated_at, jobs ( title, companies ( name ) )";

export const PROFILE_SELECT = "id,full_name,headline,bio,skills,preferences,role,avatar_path";

export const PRIVACY_PURPOSE_SELECT =
  "purpose_code,version,title,specific_description,classification,status,legal_basis_status,retention_status,text_status,revocation_effect,created_at";
export const PRIVACY_EVENT_SELECT =
  "id,purpose_code,purpose_version,event_type,source,proof,created_at";

/** Superfícies de lista. O teste de contrato recusa estes identificadores na string de select. */
export const LIST_SURFACES = [
  {
    id: "catalog.list",
    select: JOB_LIST_SELECT,
    forbidden: ["description", "requirements"],
  },
  {
    id: "catalog.list.search",
    select: JOB_LIST_SELECT_SEARCH,
    forbidden: ["description", "requirements"],
  },
  {
    id: "admin.jobs.list",
    select: ADMIN_JOB_LIST_SELECT,
    forbidden: ["description", "requirements", "job_curation_reviews", "internal_comment"],
  },
  {
    id: "admin.jobs.list.search",
    select: ADMIN_JOB_LIST_SELECT_SEARCH,
    forbidden: ["description", "requirements", "job_curation_reviews", "internal_comment"],
  },
  {
    id: "curation.list",
    select: CURATION_LIST_FIELDS,
    forbidden: ["description", "requirements", "job_curation_reviews"],
  },
  {
    id: "ingest.list",
    select: INGESTION_LIST_SELECT,
    forbidden: ["canonical_payload", "job_ingestion_attempts", "payload_hash"],
  },
  {
    id: "applications.list",
    select: APPLICATION_LIST_SELECT,
    forbidden: ["snapshot"],
  },
];

/** Detalhe precisa continuar explícito. O teste falha se a coluna pesada sumir do select. */
export const DETAIL_SURFACES = [
  { id: "catalog.detail", select: JOB_DETAIL_SELECT, required: ["description", "requirements"] },
  { id: "catalog.detail.heavy", select: JOB_DETAIL_HEAVY_SELECT, required: ["description", "requirements"] },
  { id: "admin.jobs.form", select: ADMIN_JOB_SELECT, required: ["description"] },
  { id: "curation.detail", select: CURATION_DETAIL_FIELDS, required: ["description"] },
  { id: "ingest.detail", select: INGESTION_DETAIL_SELECT, required: ["canonical_payload"] },
  { id: "applications.detail", select: APPLICATION_SELECT, required: ["snapshot"] },
];
