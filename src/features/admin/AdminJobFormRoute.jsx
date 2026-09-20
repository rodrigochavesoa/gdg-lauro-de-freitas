import React, { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  createPendingJob,
  loadAdminJob,
  loadCompanies,
  updatePendingJob,
  validateAdminJob,
} from "../../lib/admin-api.js";
import { AutoResizeTextarea, TEXTAREA_LIMITS } from "../../shared/ui/AutoResizeTextarea.jsx";
import { emptyJobForm, jobToForm } from "./job-form-state.js";

export function AdminJobFormRoute() {
  const [searchParams] = useSearchParams();
  const editingFromQuery = searchParams.get("editar") || "";
  const [form, setForm] = useState(emptyJobForm);
  const [editingId, setEditingId] = useState("");
  const [companies, setCompanies] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [formErrors, setFormErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  const field = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  useEffect(() => {
    let cancelled = false;
    loadCompanies()
      .then((rows) => {
        if (!cancelled) setCompanies(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!editingFromQuery) {
      setEditingId("");
      return undefined;
    }
    let cancelled = false;
    loadAdminJob(editingFromQuery)
      .then((job) => {
        if (cancelled) return;
        if (!job || job.status !== "pending") {
          setMessage(job ? "Edite via nova rodada na Curadoria." : "Vaga não encontrada ou indisponível.");
          setEditingId("");
          return;
        }
        setEditingId(job.id);
        setForm(jobToForm(job));
        setMessage(`Editando ${job.title}.`);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [editingFromQuery]);

  const persist = async (asUpdate) => {
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
        setMessage("Vaga cadastrada como pendente de curadoria.");
      }
      setForm(emptyJobForm);
      setEditingId("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    persist(false);
  };

  return (
    <>
      <div className="admin-title">
        <div>
          <span className="eyebrow">Área administrativa</span>
          <h1>Publicar nova vaga</h1>
          <p>As vagas entram como pendentes e passam pela curadoria da comunidade.</p>
        </div>
      </div>
      <form className="job-form" onSubmit={onSubmit}>
        <div className="form-section">
          <h2>Informações da vaga</h2>
          <div className="form-grid">
            <label className="wide">
              Título da vaga
              <input id="admin-job-title" name="title" required value={form.title} onChange={field("title")} placeholder="Ex.: Pessoa Desenvolvedora Front-end" />
            </label>
            <label>
              Empresa
              <select id="admin-job-company" name="companyId" value={form.companyId} onChange={field("companyId")}>
                <option value="">Selecione uma empresa</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nova empresa fictícia
              <input id="admin-job-new-company" name="newCompanyName" value={form.newCompanyName} onChange={field("newCompanyName")} placeholder="Opcional se já selecionou" />
            </label>
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
              Modelo
              <select id="admin-job-work-model" name="workModel" value={form.workModel} onChange={field("workModel")}>
                <option>Remoto</option>
                <option>Híbrido</option>
                <option>Presencial</option>
              </select>
            </label>
            <label>
              Tipo de contrato
              <select id="admin-job-contract" name="contractType" defaultValue="CLT">
                <option>CLT</option>
                <option>PJ</option>
                <option>Estágio</option>
              </select>
            </label>
          </div>
        </div>
        {message && (
          <div className="success">
            <Check size={18} /> {message}
          </div>
        )}
        {(formErrors.length > 0 || error) && (
          <div className="form-alert" role="alert">
            {formErrors.length > 0 ? (
              <ul>
                {formErrors.map((item) => (
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
          <button className="primary" type="submit" disabled={busy} aria-label="Cadastrar para curadoria">
            <Plus size={17} />
            <span className="hide-mobile">Cadastrar para curadoria</span>
            <span className="job-form-submit-mobile">Cadastrar vaga</span>
          </button>
        </div>
      </form>
    </>
  );
}
