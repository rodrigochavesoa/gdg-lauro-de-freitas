import React, { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  createPendingJob,
  loadAdminJob,
  updatePendingJob,
  validateAdminJob,
} from "../../lib/admin-api.js";
import { CATALOG_COUNTRIES } from "../../lib/catalog-url.js";
import { AutoResizeTextarea, TEXTAREA_LIMITS } from "../../shared/ui/AutoResizeTextarea.jsx";
import { AdminCompanyPicker } from "./AdminCompanyPicker.jsx";
import { emptyJobForm, jobToForm } from "./job-form-state.js";

const STRUCTURED_ERROR = /país|salário|faixa/i;

function describedBy(hintId, invalid) {
  return invalid ? `${hintId} admin-job-structured-errors` : hintId;
}

export function AdminJobFormRoute() {
  const [searchParams] = useSearchParams();
  const editingFromQuery = searchParams.get("editar") || "";
  const [form, setForm] = useState(emptyJobForm);
  const [editingId, setEditingId] = useState("");
  const [editLoadStatus, setEditLoadStatus] = useState(() => (editingFromQuery ? "loading" : "idle"));
  const [editReloadToken, setEditReloadToken] = useState(0);
  const [loadedEditingQuery, setLoadedEditingQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [fictionalCompanyMode, setFictionalCompanyMode] = useState(false);
  const [companyLinkedByCreation, setCompanyLinkedByCreation] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [formErrors, setFormErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  const field = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  useEffect(() => {
    if (!editingFromQuery) {
      setEditingId("");
      setEditLoadStatus("idle");
      return undefined;
    }
    let cancelled = false;
    setEditLoadStatus("loading");
    setError("");
    loadAdminJob(editingFromQuery)
      .then((job) => {
        if (cancelled) return;
        if (!job || job.status !== "pending") {
          setMessage(job ? "Edite via nova rodada na Curadoria." : "Vaga não encontrada ou indisponível.");
          setEditingId("");
          setEditLoadStatus("unavailable");
          return;
        }
        setEditingId(job.id);
        setForm(jobToForm(job));
        setSelectedCompany(job.company_id ? { id: job.company_id, name: job.companies?.name ?? "Empresa cadastrada" } : null);
        setFictionalCompanyMode(false);
        setCompanyLinkedByCreation(false);
        setMessage(`Editando ${job.title}.`);
        setLoadedEditingQuery(editingFromQuery);
        setEditLoadStatus("ready");
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Não foi possível carregar a vaga para edição.");
          setEditLoadStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [editReloadToken, editingFromQuery]);

  const persist = async (asUpdate) => {
    if (editingFromQuery && editLoadStatus !== "ready") return;
    setBusy(true);
    setError("");
    setFormErrors([]);
    setMessage("");
    const fieldErrors = validateAdminJob(form, { requireCompany: !(asUpdate && editingId) });
    if (fieldErrors.length) {
      setFormErrors(fieldErrors);
      setBusy(false);
      return;
    }
    try {
      if (asUpdate && editingId) {
        await updatePendingJob(editingId, form);
        setMessage("Rascunho atualizado. A vaga permanece pendente de curadoria.");
      } else {
        const created = await createPendingJob(form);
        setEditingId(created.id);
        const createdWithFictionalCompany = !form.companyId && Boolean(form.newCompanyName.trim());
        setFictionalCompanyMode(false);
        setCompanyLinkedByCreation(createdWithFictionalCompany);
        if (createdWithFictionalCompany) {
          setForm((current) => ({ ...current, newCompanyName: "" }));
        }
        setMessage("Vaga cadastrada como pendente de curadoria.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    persist(Boolean(editingId));
  };

  const useFictionalCompany = () => {
    setSelectedCompany(null);
    setCompanyLinkedByCreation(false);
    setForm((current) => ({ ...current, companyId: "", newCompanyName: "" }));
    setFictionalCompanyMode(true);
  };

  const useRegisteredCompany = () => {
    setSelectedCompany(null);
    setCompanyLinkedByCreation(false);
    setForm((current) => ({ ...current, companyId: "", newCompanyName: "" }));
    setFictionalCompanyMode(false);
  };

  const structuredErrors = formErrors.filter((item) => STRUCTURED_ERROR.test(item));
  const otherErrors = formErrors.filter((item) => !structuredErrors.includes(item));
  const countryInvalid = structuredErrors.some((item) => /país/i.test(item));
  const salaryInvalid = structuredErrors.some((item) => /salário|faixa/i.test(item));

  return (
    <>
      <div className="admin-title">
        <div>
          <span className="eyebrow">Área administrativa</span>
          <h1>Nova vaga</h1>
          <p>As vagas entram como pendentes e passam pela curadoria da comunidade.</p>
        </div>
      </div>
      {editingFromQuery && editLoadStatus !== "error" && editLoadStatus !== "unavailable" && loadedEditingQuery !== editingFromQuery ? <p role="status">Carregando vaga para edição…</p> : null}
      {editingFromQuery && editLoadStatus === "error" ? (
        <div className="form-alert" role="alert">
          <p>{error}</p>
          <button type="button" className="outline small" onClick={() => setEditReloadToken((token) => token + 1)}>
            Tentar novamente
          </button>
        </div>
      ) : null}
      {editingFromQuery && editLoadStatus === "unavailable" ? <p role="status">{message}</p> : null}
      {(!editingFromQuery || (editLoadStatus === "ready" && loadedEditingQuery === editingFromQuery)) ? <form className="job-form" onSubmit={onSubmit}>
        <div className="form-section">
          <h2>Informações da vaga</h2>
          <div className="form-grid">
            <label className="wide">
              Título da vaga
              <input id="admin-job-title" name="title" required value={form.title} onChange={field("title")} placeholder="Ex.: Pessoa Desenvolvedora Front-end" />
            </label>
            <div className="wide admin-job-company-field">
              {fictionalCompanyMode ? (
                <>
                  <label htmlFor="admin-job-new-company">Nome da empresa fictícia</label>
                  <input
                    id="admin-job-new-company"
                    name="newCompanyName"
                    value={form.newCompanyName}
                    onChange={(event) => setForm((current) => ({ ...current, companyId: "", newCompanyName: event.target.value }))}
                    placeholder="Digite o nome da empresa"
                  />
                  <p className="filter-hint">Use essa opção quando a empresa não estiver cadastrada. O sistema reutiliza um cadastro existente com o mesmo nome.</p>
                  <button type="button" className="ghost small" onClick={useRegisteredCompany}>Buscar empresa cadastrada</button>
                </>
              ) : (
                <>
                  {companyLinkedByCreation && !selectedCompany ? (
                    <p className="filter-hint" role="status">Empresa vinculada ao rascunho. Busque outra empresa cadastrada se precisar alterá-la.</p>
                  ) : null}
                  <AdminCompanyPicker
                    selectedCompany={selectedCompany}
                    onSelect={(company) => {
                      setSelectedCompany(company);
                      setCompanyLinkedByCreation(false);
                      setForm((current) => ({ ...current, companyId: company?.id ?? "", newCompanyName: "" }));
                    }}
                    disabled={busy}
                  />
                  {!editingId ? <button type="button" className="ghost small" onClick={useFictionalCompany}>Não encontrou? Informar empresa fictícia</button> : null}
                </>
              )}
            </div>
            <label>
              Nível
              <select id="admin-job-level" name="level" required value={form.level} onChange={field("level")}>
                <option value="">Selecione o nível</option>
                <option>Júnior</option>
                <option>Pleno</option>
                <option>Sênior</option>
                <option>Estágio</option>
              </select>
            </label>
            <div className="wide field-with-counter">
              <label htmlFor="admin-job-description">Descrição</label>
              <AutoResizeTextarea
                id="admin-job-description"
                name="description"
                required
                value={form.description}
                onChange={field("description")}
                placeholder="Descreva a oportunidade, responsabilidades e requisitos..."
                rows={6}
                maxLength={TEXTAREA_LIMITS.jobDescription}
                maxHeightPx={360}
              />
            </div>
          </div>
        </div>
        <div className="form-section">
          <h2>Detalhes</h2>
          <div className="form-grid">
            <label>
              Tecnologias
              <input id="admin-job-stack" name="stackText" value={form.stackText} onChange={field("stackText")} placeholder="React, TypeScript, Next.js" />
            </label>
            <label>
              Localidade
              <input id="admin-job-location" name="location" value={form.location} onChange={field("location")} placeholder="Ex.: Remoto · Brasil" />
            </label>
            <label>
              País
              <select
                id="admin-job-country"
                name="countryCode"
                value={form.countryCode}
                onChange={field("countryCode")}
                aria-invalid={countryInvalid || undefined}
                aria-describedby={describedBy("admin-job-country-hint", countryInvalid)}
              >
                <option value="">Não informado</option>
                {CATALOG_COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.label}
                  </option>
                ))}
              </select>
            </label>
            <p id="admin-job-country-hint" className="filter-hint wide">
              Opcional. O texto da localidade não define o país.
            </p>
            <label>
              Salário mínimo (R$)
              <input
                id="admin-job-salary-min"
                name="salaryMinText"
                inputMode="decimal"
                value={form.salaryMinText}
                onChange={field("salaryMinText")}
                placeholder="8000"
                aria-invalid={salaryInvalid || undefined}
                aria-describedby={describedBy("admin-job-salary-hint", salaryInvalid)}
              />
            </label>
            <label>
              Salário máximo (R$)
              <input
                id="admin-job-salary-max"
                name="salaryMaxText"
                inputMode="decimal"
                value={form.salaryMaxText}
                onChange={field("salaryMaxText")}
                placeholder="12000"
                aria-invalid={salaryInvalid || undefined}
                aria-describedby={describedBy("admin-job-salary-hint", salaryInvalid)}
              />
            </label>
            <p id="admin-job-salary-hint" className="filter-hint wide">
              Opcional, em reais. Em branco nos dois campos, a vaga fica A combinar.
            </p>
            {structuredErrors.length > 0 ? (
              <div className="form-alert wide" id="admin-job-structured-errors" role="alert">
                <ul>
                  {structuredErrors.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <label>
              Modelo
              <select id="admin-job-work-model" name="workModel" value={form.workModel} onChange={field("workModel")}>
                <option>Remoto</option>
                <option>Híbrido</option>
                <option>Presencial</option>
              </select>
            </label>
          </div>
        </div>
        {message && (
          <div className="success">
            <Check size={18} /> {message}
          </div>
        )}
        {(otherErrors.length > 0 || error) && (
          <div className="form-alert" id="admin-job-form-errors" role="alert">
            {otherErrors.length > 0 ? (
              <ul>
                {otherErrors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>{error}</p>
            )}
          </div>
        )}
        <div className="form-actions">
          <button type="button" className="ghost" disabled={busy || !editingId} onClick={() => persist(true)}>
            Salvar rascunho
          </button>
          <button className="primary" type="submit" disabled={busy} aria-label="Enviar à curadoria">
            <Plus size={17} />
            <span className="hide-mobile">Enviar à curadoria</span>
            <span className="job-form-submit-mobile">Enviar à curadoria</span>
          </button>
        </div>
      </form> : null}
    </>
  );
}
