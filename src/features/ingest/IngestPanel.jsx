import React, { useEffect, useMemo, useRef, useState } from "react";
import { Filter } from "lucide-react";
import {
  HOMOLOG_MANUAL_FIXTURE,
  describeIngestionOutcome,
  latestIngestionAttempt,
  loadJobIngestionDetail,
  loadJobIngestions,
  processJobIngestion,
} from "./ingest-api.js";
import { SOURCE_KINDS, isIngestionExpired } from "./source-contract.js";
import { LEVEL_TO_DB, MODEL_TO_DB, parseStack, structuredJobColumns } from "../../lib/admin-api.js";
import { CATALOG_COUNTRIES } from "../../lib/catalog-url.js";
import { mergeById } from "../../lib/merge-by-id.js";
import { AdminPanelShimmer } from "../../shared/ui/AdminPanelShimmer.jsx";
import { AdminBackButton } from "../../shared/ui/AdminBackControl.jsx";
import { AdminListSearch } from "../../shared/ui/AdminListSearch.jsx";
import { useDebouncedValue } from "../../shared/ui/useDebouncedValue.js";
import { FilterSheet } from "../../shared/ui/FilterSheet.jsx";

const INGESTION_STATUS_FILTERS = [
  ["all", "Todos os status"],
  ["registered", "Registrada"],
  ["materialized", "Materializada"],
  ["idempotent", "Já processada"],
  ["failed", "Falha"],
  ["expired", "Expirada"],
  ["duplicate_010", "Duplicata 010"],
];

function ingestionStatusValue(row) {
  if (isIngestionExpired(row?.expires_at)) return "expired";
  return row?.latest_outcome || latestIngestionAttempt(row)?.outcome || "registered";
}

const emptyForm = {
  locator: HOMOLOG_MANUAL_FIXTURE.locator,
  expiresAt: "",
  title: HOMOLOG_MANUAL_FIXTURE.payload.title,
  companyName: HOMOLOG_MANUAL_FIXTURE.payload.company_name,
  level: "Júnior",
  description: HOMOLOG_MANUAL_FIXTURE.payload.description,
  stackText: "React, TypeScript",
  location: HOMOLOG_MANUAL_FIXTURE.payload.location,
  countryCode: "",
  salaryMinText: "",
  salaryMaxText: "",
  workModel: "Remoto",
};

function toPayload(form) {
  const structured = structuredJobColumns(form);
  if (structured.errors.length) {
    const error = new Error(structured.errors[0]);
    error.errors = structured.errors;
    throw error;
  }
  const payload = {
    title: form.title,
    company_name: form.companyName,
    description: form.description,
    level: LEVEL_TO_DB[form.level],
    work_model: MODEL_TO_DB[form.workModel],
    location: form.location,
    stack: parseStack(form.stackText),
  };
  const { country_code: countryCode, salary_min: salaryMin, salary_max: salaryMax } = structured.columns;
  if (countryCode) payload.country_code = countryCode;
  if (salaryMin != null) payload.salary_min = salaryMin;
  if (salaryMax != null) payload.salary_max = salaryMax;
  return payload;
}

function expiresAtIso(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function ingestionListTitle(row) {
  return row?.jobs?.title || row?.payload_title || row?.canonical_payload?.title || "Origem registrada";
}

function ingestionListStatus(row) {
  if (isIngestionExpired(row?.expires_at)) return "Expirada";
  if (row?.latest_outcome) return describeIngestionOutcome(row.latest_outcome);
  const attempt = latestIngestionAttempt(row);
  return attempt ? describeIngestionOutcome(attempt.outcome) : "Registrada";
}

export function IngestPanel() {
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [view, setView] = useState("list");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailStatus, setDetailStatus] = useState("idle");
  const [queryInput, setQueryInput] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const query = useDebouncedValue(submittedQuery).trim().toLocaleLowerCase("pt-BR");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const mountedRef = useRef(false);
  const listRequestRef = useRef(0);
  const loadMoreRequestRef = useRef(0);
  const detailRequestRef = useRef(0);
  const viewGenerationRef = useRef(0);
  const listRow = rows.find((row) => row.id === selectedId) ?? null;
  const filteredRows = useMemo(() => rows.filter((row) => {
    if (statusFilter !== "all" && ingestionStatusValue(row) !== statusFilter) return false;
    if (sourceFilter !== "all" && row.source_kind !== sourceFilter) return false;
    if (!query) return true;
    const searchable = `${ingestionListTitle(row)} ${row.normalized_locator ?? ""} ${row.source_kind ?? ""} ${ingestionListStatus(row)}`;
    return searchable.toLocaleLowerCase("pt-BR").includes(query);
  }), [query, rows, sourceFilter, statusFilter]);
  const activeFilterCount = Number(statusFilter !== "all") + Number(sourceFilter !== "all");
  const resetFilters = () => {
    setStatusFilter("all");
    setSourceFilter("all");
    setQueryInput("");
    setSubmittedQuery("");
  };
  const applySearch = (event) => {
    event.preventDefault();
    setSubmittedQuery(queryInput.trim());
  };
  const clearSearch = () => {
    setQueryInput("");
    setSubmittedQuery("");
  };

  const renderFilterControls = (suffix) => (
    <>
      <label className="admin-jobs-sort" htmlFor={`ingest-status-filter-${suffix}`}>
        Status
        <select id={`ingest-status-filter-${suffix}`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          {INGESTION_STATUS_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="admin-jobs-sort" htmlFor={`ingest-source-filter-${suffix}`}>
        Fonte
        <select id={`ingest-source-filter-${suffix}`} value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
          <option value="all">Todas as fontes</option>
          {SOURCE_KINDS.MANUAL_FIXTURE ? <option value={SOURCE_KINDS.MANUAL_FIXTURE}>Fixture manual</option> : null}
          {SOURCE_KINDS.STAFF_REPLAY ? <option value={SOURCE_KINDS.STAFF_REPLAY}>Reprocessamento interno</option> : null}
        </select>
      </label>
    </>
  );

  const field = (name) => (event) => {
    setForm((current) => ({ ...current, [name]: event.target.value }));
  };

  const refresh = async ({ append = false, nextPage = 1 } = {}) => {
    if (!mountedRef.current) return;
    const listRequest = append ? listRequestRef.current : ++listRequestRef.current;
    const loadMoreRequest = append ? ++loadMoreRequestRef.current : null;
    const isCurrentRequest = () => mountedRef.current
      && listRequest === listRequestRef.current
      && (!append || loadMoreRequest === loadMoreRequestRef.current);
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setLoadingMore(false);
    }
    try {
      const result = await loadJobIngestions(undefined, { page: nextPage });
      if (!isCurrentRequest()) return;
      setRows((current) => (append ? mergeById(current, result.items) : result.items));
      setHasNext(Boolean(result.hasNext));
      setPage(result.page ?? nextPage);
      setError("");
    } catch (err) {
      if (!isCurrentRequest()) return;
      if (!append) setRows([]);
      setHasNext(false);
      setError(err.message || "Não foi possível carregar as ingestões.");
    } finally {
      if (isCurrentRequest()) {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    }
  };

  const openDetail = async (id) => {
    if (!mountedRef.current) return;
    viewGenerationRef.current += 1;
    const detailRequest = ++detailRequestRef.current;
    const isCurrentRequest = () => mountedRef.current && detailRequest === detailRequestRef.current;
    setSelectedId(id);
    setView("detail");
    setDetail(null);
    setDetailStatus("loading");
    setError("");
    setMessage("");
    try {
      const row = await loadJobIngestionDetail(undefined, id);
      if (!isCurrentRequest()) return;
      setDetail(row);
      setDetailStatus(row ? "ready" : "error");
      if (!row) setError("Registro indisponível. Volte à lista e tente novamente.");
    } catch (err) {
      if (!isCurrentRequest()) return;
      setDetailStatus("error");
      setError(err.message || "Não foi possível carregar o detalhe da ingestão.");
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
      listRequestRef.current += 1;
      loadMoreRequestRef.current += 1;
      detailRequestRef.current += 1;
    };
  }, []);

  const runProcess = async (input, returnView = "list") => {
    const viewGeneration = viewGenerationRef.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await processJobIngestion(undefined, input);
      if (!mountedRef.current) return;
      const jobStatus = result.job?.status;
      if (jobStatus && jobStatus !== "pending" && result.outcome === "materialized") {
        if (viewGenerationRef.current === viewGeneration) setError("A ingestão recusou publicar fora de pending.");
        return;
      }
      if (viewGenerationRef.current === viewGeneration) {
        setMessage(
          `${describeIngestionOutcome(result.outcome)}${
            result.job?.title ? ` · ${result.job.title}` : ""
          }${result.failure_detail ? ` — ${result.failure_detail}` : ""}`,
        );
      }
      await refresh();
      if (!mountedRef.current || viewGenerationRef.current !== viewGeneration) return;
      if (returnView === "detail" && selectedId) {
        await openDetail(selectedId);
        return;
      }
      viewGenerationRef.current += 1;
      setView(returnView);
    } catch (err) {
      if (mountedRef.current && viewGenerationRef.current === viewGeneration) {
        setError(err.message || "Falha ao processar a ingestão.");
      }
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    let payload;
    try {
      payload = toPayload(form);
    } catch (err) {
      setMessage("");
      setError(err.errors?.join(" ") || err.message);
      return;
    }
    void runProcess({
      sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
      locator: form.locator,
      payload,
      expiresAt: expiresAtIso(form.expiresAt),
    }, "list");
  };

  const onReplay = () => {
    const payload = detail?.canonical_payload;
    if (!payload || !detail) {
      setError("Esta ingestão não tem payload canônico para reprocessar.");
      return;
    }
    void runProcess({
      sourceKind: detail.source_kind || SOURCE_KINDS.STAFF_REPLAY,
      locator: detail.normalized_locator,
      payload,
      expiresAt: detail.expires_at ?? null,
    }, "detail");
  };

  return (
    <div className="admin-ingest">
      <div className="admin-title">
        <div>
          <span className="eyebrow">Área administrativa · homologação</span>
          <h1>{view === "new" ? "Nova fixture" : view === "detail" ? "Detalhe da ingestão" : "Ingestão"}</h1>
          <p>
            {view === "new" ? "Registre uma origem de teste. A vaga criada segue pendente para curadoria." :
              view === "detail" ? "Consulte o resultado e as tentativas antes de reprocessar." :
              "Acompanhe as entradas controladas. Nenhuma ingestão publica automaticamente."}
          </p>
        </div>
        {view === "list" ? <button className="primary small" type="button" onClick={() => { viewGenerationRef.current += 1; setView("new"); setError(""); setMessage(""); }}>Nova fixture</button> :
          <AdminBackButton type="button" onClick={() => { viewGenerationRef.current += 1; detailRequestRef.current += 1; setView("list"); setError(""); }}>Voltar às ingestões</AdminBackButton>}
      </div>
      {message ? <div className="success" role="status">{message}</div> : null}
      {error ? <div className="form-alert" role="alert">{error}</div> : null}
      {view === "new" ? (
      <form className="job-form" onSubmit={onSubmit}>
        <div className="form-section">
          <h2>Origem fictícia</h2>
          <div className="form-grid">
            <label className="wide">
              Localizador
              <input
                id="ingest-locator"
                name="locator"
                required
                value={form.locator}
                onChange={field("locator")}
                placeholder="fixture:homolog-acme-frontend"
              />
            </label>
            <label>
              Expira em (opcional)
              <input
                id="ingest-expires"
                name="expiresAt"
                type="datetime-local"
                value={form.expiresAt}
                onChange={field("expiresAt")}
              />
            </label>
            <label className="wide">
              Título da vaga
              <input id="ingest-title" name="title" required value={form.title} onChange={field("title")} />
            </label>
            <label>
              Empresa fictícia
              <input
                id="ingest-company"
                name="companyName"
                required
                value={form.companyName}
                onChange={field("companyName")}
              />
            </label>
            <label>
              Nível
              <select id="ingest-level" name="level" required value={form.level} onChange={field("level")}>
                <option>Júnior</option>
                <option>Pleno</option>
                <option>Sênior</option>
                <option>Estágio</option>
              </select>
            </label>
            <label className="wide">
              Descrição
              <textarea
                id="ingest-description"
                name="description"
                required
                rows={5}
                value={form.description}
                onChange={field("description")}
              />
            </label>
            <label>
              Tecnologias
              <input id="ingest-stack" name="stackText" value={form.stackText} onChange={field("stackText")} />
            </label>
            <label>
              Localidade
              <input id="ingest-location" name="location" value={form.location} onChange={field("location")} />
            </label>
            <label>
              País
              <select
                id="ingest-country"
                name="countryCode"
                value={form.countryCode}
                onChange={field("countryCode")}
                aria-describedby="ingest-country-hint"
              >
                <option value="">Não informado</option>
                {CATALOG_COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.label}
                  </option>
                ))}
              </select>
            </label>
            <p id="ingest-country-hint" className="filter-hint wide">
              Opcional. O texto da localidade não define o país.
            </p>
            <label>
              Salário mínimo (R$)
              <input
                id="ingest-salary-min"
                name="salaryMinText"
                inputMode="decimal"
                value={form.salaryMinText}
                onChange={field("salaryMinText")}
                aria-describedby="ingest-salary-hint"
              />
            </label>
            <label>
              Salário máximo (R$)
              <input
                id="ingest-salary-max"
                name="salaryMaxText"
                inputMode="decimal"
                value={form.salaryMaxText}
                onChange={field("salaryMaxText")}
                aria-describedby="ingest-salary-hint"
              />
            </label>
            <p id="ingest-salary-hint" className="filter-hint wide">
              Opcional, em reais. Em branco nos dois campos, a vaga fica A combinar.
            </p>
            <label>
              Modelo
              <select id="ingest-work-model" name="workModel" value={form.workModel} onChange={field("workModel")}>
                <option>Remoto</option>
                <option>Híbrido</option>
                <option>Presencial</option>
              </select>
            </label>
          </div>
        </div>
        <div className="form-actions">
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Processando ingestão…" : "Ingerir fixture (pendente)"}
          </button>
        </div>
      </form>
      ) : null}
      {view === "list" ? (
        <>
        {filterOpen ? (
          <FilterSheet open onClose={() => setFilterOpen(false)} resultCount={filteredRows.length} titleId="ingest-filters-title">
            <div className="filter-head">
              <h2 id="ingest-filters-title"><Filter size={18} /> Filtros</h2>
              <button type="button" onClick={resetFilters}>Limpar</button>
            </div>
            <div className="filters__body">
              <div className="filter-group admin-ingest__filter-controls">{renderFilterControls("mobile")}</div>
            </div>
          </FilterSheet>
        ) : null}
        <AdminListSearch id="ingest-list-search-query" value={queryInput} onChange={setQueryInput} onSubmit={applySearch} onClear={clearSearch} label="Buscar ingestões" placeholder="Título, localizador ou fonte" />
        <div className="admin-jobs-toolbar-row admin-jobs-toolbar--desktop admin-ingest__toolbar">
          {renderFilterControls("desktop")}
        </div>
        <section
          className="admin-ingest__list"
          aria-label="Ingestões registradas"
          aria-busy={loading || loadingMore ? "true" : undefined}
        >
        <div className="result-head admin-jobs-result-head">
          <div><h2>Registros</h2><p className="admin-jobs-count" aria-live="polite">{!loading && !error ? `${filteredRows.length} de ${rows.length} carregadas` : ""}</p></div>
          <button className="filter-mobile" type="button" aria-expanded={filterOpen} onClick={() => setFilterOpen(true)}>
            <Filter size={16} /> Filtros {activeFilterCount > 0 ? <b>{activeFilterCount}</b> : null}
          </button>
        </div>
        {loading ? (
          <>
            <p className="sr-only" role="status">Carregando ingestões…</p>
            {rows.length === 0 ? <AdminPanelShimmer variant="list" /> : null}
          </>
        ) : null}
        {!loading && rows.length === 0 && !error ? (
          <p role="status">Nenhuma ingestão registrada.</p>
        ) : null}
        {!loading && rows.length > 0 && filteredRows.length === 0 ? (
          <div className="admin-jobs-list-panel__empty" role="status">
            <p>Nenhuma ingestão corresponde à busca e aos filtros.</p>
            <button type="button" className="ghost small" onClick={resetFilters}>Limpar busca e filtros</button>
          </div>
        ) : null}
        {error ? <button type="button" className="outline small" onClick={() => { void refresh(); }}>Tentar novamente</button> : null}
        {filteredRows.map((row) => (
            <div key={row.id} className="admin-ingest__row">
              <div>
                <strong>{ingestionListTitle(row)}</strong>
                <p>{row.jobs?.status === "pending" ? "Vaga pendente" : row.jobs?.status ? `Vaga: ${row.jobs.status}` : "Sem vaga vinculada"}</p>
              </div>
              <span className="admin-job-status">{ingestionListStatus(row)}</span>
              <button type="button" className="ghost small" onClick={() => { void openDetail(row.id); }}>
                Ver detalhes
              </button>
            </div>
        ))}
        {hasNext ? (
          <div className="admin-jobs-more">
            {(query || activeFilterCount > 0) ? <p className="filter-hint">Busca e filtros consideram apenas as ingestões já carregadas.</p> : null}
            <button type="button" className="outline" onClick={() => { void refresh({ append: true, nextPage: page + 1 }); }} disabled={loadingMore}>
              {loadingMore ? "Carregando…" : "Carregar mais"}
            </button>
          </div>
        ) : null}
      </section>
        </>
      ) : null}
      {view === "detail" && selectedId ? (
        <section
          className="admin-ingest__detail"
          aria-label="Detalhe da ingestão"
          aria-busy={detailStatus === "loading" ? "true" : undefined}
        >
          <h2>{ingestionListTitle(detail ?? listRow)}</h2>
          {detailStatus === "loading" ? (
            <>
              <p className="sr-only" role="status">Carregando detalhes da ingestão…</p>
              <AdminPanelShimmer variant="detail" />
            </>
          ) : null}
          {detail ? (
            <>
              <p><strong>Estado:</strong> {ingestionListStatus(detail)}</p>
              <p><strong>Vaga:</strong> {detail.jobs?.status ?? "Não materializada"}</p>
              <p className="admin-ingest__locator"><strong>Localizador:</strong> {detail.normalized_locator}</p>
              {detail.expires_at ? <p><strong>Expira em:</strong> {new Date(detail.expires_at).toLocaleString("pt-BR")}</p> : null}
              <details>
                <summary>Tentativas e falhas</summary>
                {(detail.job_ingestion_attempts ?? []).length === 0 ? <p>Nenhuma tentativa registrada.</p> :
                  <ol>{detail.job_ingestion_attempts.map((attempt) => <li key={attempt.id}>
                    {describeIngestionOutcome(attempt.outcome)}{attempt.failure_detail ? ` — ${attempt.failure_detail}` : ""}
                  </li>)}</ol>}
              </details>
              <button type="button" className="outline" disabled={busy || !detail.canonical_payload} onClick={onReplay}>
                {busy ? "Reprocessando…" : "Reprocessar"}
              </button>
            </>
          ) : null}
          {detailStatus === "error" ? (
            <button type="button" className="outline small" onClick={() => { void openDetail(selectedId); }}>
              Tentar novamente
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
