import React, { useEffect, useState } from "react";
import {
  HOMOLOG_MANUAL_FIXTURE,
  describeIngestionOutcome,
  latestIngestionAttempt,
  loadJobIngestions,
  processJobIngestion,
} from "./ingest-api.js";
import { SOURCE_KINDS, isIngestionExpired } from "./source-contract.js";
import { LEVEL_TO_DB, MODEL_TO_DB, parseStack } from "../../lib/admin-api.js";

const emptyForm = {
  locator: HOMOLOG_MANUAL_FIXTURE.locator,
  expiresAt: "",
  title: HOMOLOG_MANUAL_FIXTURE.payload.title,
  companyName: HOMOLOG_MANUAL_FIXTURE.payload.company_name,
  level: "Júnior",
  description: HOMOLOG_MANUAL_FIXTURE.payload.description,
  stackText: "React, TypeScript",
  location: HOMOLOG_MANUAL_FIXTURE.payload.location,
  workModel: "Remoto",
};

function toPayload(form) {
  return {
    title: form.title,
    company_name: form.companyName,
    description: form.description,
    level: LEVEL_TO_DB[form.level],
    work_model: MODEL_TO_DB[form.workModel],
    location: form.location,
    stack: parseStack(form.stackText),
  };
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

  const runProcess = async (input) => {
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
    } catch (err) {
      setError(err.message || "Falha ao processar a ingestão.");
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    void runProcess({
      sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
      locator: form.locator,
      payload: toPayload(form),
      expiresAt: expiresAtIso(form.expiresAt),
    });
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
    });
  };

  return (
    <div>
      <div className="admin-title">
        <div>
          <span className="eyebrow">Ingestão controlada</span>
          <h1>Entrada manual / fixture</h1>
          <p>
            Homologação: registra a origem, materializa como pendente e encaminha à curadoria. Não publica no
            catálogo.
          </p>
        </div>
      </div>
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
              Modelo
              <select id="ingest-work-model" name="workModel" value={form.workModel} onChange={field("workModel")}>
                <option>Remoto</option>
                <option>Híbrido</option>
                <option>Presencial</option>
              </select>
            </label>
          </div>
        </div>
        {message ? <div className="success">{message}</div> : null}
        {error ? (
          <div className="form-alert" role="alert">
            {error}
          </div>
        ) : null}
        <div className="form-actions">
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Processando ingestão…" : "Ingerir fixture (pendente)"}
          </button>
        </div>
      </form>
      <div className="form-section admin-job-list">
        <h2>Ingestões registradas</h2>
        {loading ? <p role="status">Carregando ingestões…</p> : null}
        {!loading && rows.length === 0 && !error ? (
          <p role="status">Nenhuma ingestão registrada.</p>
        ) : null}
        {rows.map((row) => {
          const attempt = latestIngestionAttempt(row);
          const expired = isIngestionExpired(row.expires_at);
          return (
            <div key={row.id} className="admin-job-list-block">
              <p className="ghost admin-job-list-item">
                <span className="featured">
                  {expired ? "Expirada" : attempt ? describeIngestionOutcome(attempt.outcome) : "Registrada"}
                </span>
                <span className="admin-job-list-title">{row.jobs?.title ?? row.canonical_payload?.title ?? row.normalized_locator}</span>
                <span className="admin-job-list-meta"> · {row.normalized_locator}</span>
              </p>
              {attempt?.failure_detail ? <p>{attempt.failure_detail}</p> : null}
              {row.jobs?.status ? <p>Vaga: {row.jobs.status}</p> : null}
              <button type="button" className="ghost" disabled={busy || !row.canonical_payload} onClick={() => onReplay(row)}>
                Reprocessar
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
