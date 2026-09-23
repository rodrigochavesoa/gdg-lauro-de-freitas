import React, { useEffect, useState } from "react";
import {
  HOMOLOG_MANUAL_FIXTURE,
  describeIngestionOutcome,
  latestIngestionAttempt,
  loadJobIngestions,
  processJobIngestion,
} from "./ingest-api.js";
import { SOURCE_KINDS, isIngestionExpired } from "./source-contract.js";
import { LEVEL_TO_DB, MODEL_TO_DB, parseStack, structuredJobColumns } from "../../lib/admin-api.js";
import { CATALOG_COUNTRIES } from "../../lib/catalog-url.js";

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

export function IngestPanel() {
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [view, setView] = useState("list");
  const [selectedId, setSelectedId] = useState(null);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  const field = (name) => (event) => {
    setForm((current) => ({ ...current, [name]: event.target.value }));
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await loadJobIngestions();
      setRows(data);
      setError("");
    } catch (err) {
      setRows([]);
      setError(err.message || "Não foi possível carregar as ingestões.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const runProcess = async (input, returnView = "list") => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await processJobIngestion(undefined, input);
      const jobStatus = result.job?.status;
      if (jobStatus && jobStatus !== "pending" && result.outcome === "materialized") {
        setError("A ingestão recusou publicar fora de pending.");
        return;
      }
      setMessage(
        `${describeIngestionOutcome(result.outcome)}${
          result.job?.title ? ` · ${result.job.title}` : ""
        }${result.failure_detail ? ` — ${result.failure_detail}` : ""}`,
      );
      await refresh();
      setView(returnView);
    } catch (err) {
      setError(err.message || "Falha ao processar a ingestão.");
    } finally {
      setBusy(false);
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

  const onReplay = (row) => {
    const payload = row.canonical_payload;
    if (!payload) {
      setError("Esta ingestão não tem payload canônico para reprocessar.");
      return;
    }
    void runProcess({
      sourceKind: row.source_kind || SOURCE_KINDS.STAFF_REPLAY,
      locator: row.normalized_locator,
      payload,
      expiresAt: row.expires_at ?? null,
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
        {view === "list" ? <button className="primary small" type="button" onClick={() => { setView("new"); setError(""); setMessage(""); }}>Nova fixture</button> :
          <button className="ghost" type="button" onClick={() => { setView("list"); setError(""); }}>Voltar às ingestões</button>}
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
      {view === "list" ? <section className="admin-ingest__list" aria-label="Ingestões registradas">
        <h2>Registros <span className="admin-ingest__count">{!loading && !error ? rows.length : ""}</span></h2>
        {loading ? <p role="status">Carregando ingestões…</p> : null}
        {!loading && rows.length === 0 && !error ? (
          <p role="status">Nenhuma ingestão registrada.</p>
        ) : null}
        {error ? <button type="button" className="outline small" onClick={refresh}>Tentar novamente</button> : null}
        {rows.map((row) => {
          const attempt = latestIngestionAttempt(row);
          const expired = isIngestionExpired(row.expires_at);
          return (
            <div key={row.id} className="admin-ingest__row">
              <div>
                <strong>{row.jobs?.title ?? row.canonical_payload?.title ?? "Origem registrada"}</strong>
                <p>{row.jobs?.status === "pending" ? "Vaga pendente" : row.jobs?.status ? `Vaga: ${row.jobs.status}` : "Sem vaga vinculada"}</p>
              </div>
              <span className="admin-job-status">{expired ? "Expirada" : attempt ? describeIngestionOutcome(attempt.outcome) : "Registrada"}</span>
              <button type="button" className="ghost small" onClick={() => { setSelectedId(row.id); setView("detail"); setError(""); setMessage(""); }}>
                Ver detalhes
              </button>
            </div>
          );
        })}
      </section> : null}
      {view === "detail" && selected ? (
        <section className="admin-ingest__detail" aria-label="Detalhe da ingestão">
          <h2>{selected.jobs?.title ?? selected.canonical_payload?.title ?? "Origem registrada"}</h2>
          <p><strong>Estado:</strong> {isIngestionExpired(selected.expires_at) ? "Expirada" : latestIngestionAttempt(selected) ? describeIngestionOutcome(latestIngestionAttempt(selected).outcome) : "Registrada"}</p>
          <p><strong>Vaga:</strong> {selected.jobs?.status ?? "Não materializada"}</p>
          <p className="admin-ingest__locator"><strong>Localizador:</strong> {selected.normalized_locator}</p>
          {selected.expires_at ? <p><strong>Expira em:</strong> {new Date(selected.expires_at).toLocaleString("pt-BR")}</p> : null}
          <details>
            <summary>Tentativas e falhas</summary>
            {(selected.job_ingestion_attempts ?? []).length === 0 ? <p>Nenhuma tentativa registrada.</p> :
              <ol>{selected.job_ingestion_attempts.map((attempt) => <li key={attempt.id}>
                {describeIngestionOutcome(attempt.outcome)}{attempt.failure_detail ? ` — ${attempt.failure_detail}` : ""}
              </li>)}</ol>}
          </details>
          <button type="button" className="outline" disabled={busy || !selected.canonical_payload} onClick={() => onReplay(selected)}>
            {busy ? "Reprocessando…" : "Reprocessar"}
          </button>
        </section>
      ) : null}
      {view === "detail" && !selected ? <p role="status">Registro indisponível. Volte à lista e tente novamente.</p> : null}
    </div>
  );
}
