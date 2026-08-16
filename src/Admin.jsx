import React, { useEffect, useState } from "react";
import { BriefcaseBusiness, Building2, Check, LayoutDashboard, Plus } from "lucide-react";
import {
  createPendingJob,
  loadAdminJobs,
  loadCompanies,
  loadIsAdmin,
  signInAdmin,
  signOutAdmin,
  updatePendingJob,
} from "./lib/admin-api.js";

const emptyForm = {
  title: "",
  companyId: "",
  newCompanyName: "",
  level: "",
  description: "",
  stackText: "",
  location: "",
  workModel: "Remoto",
};

export function Admin({ setLogged }) {
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [companies, setCompanies] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const [companyRows, jobRows] = await Promise.all([loadCompanies(), loadAdminJobs()]);
    setCompanies(companyRows);
    setJobs(jobRows);
  };

  useEffect(() => {
    loadIsAdmin()
      .then(async (admin) => {
        setIsAdmin(admin);
        if (admin) {
          setLogged?.(true);
          await refresh();
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setReady(true));
  }, [setLogged]);

  const field = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const onLogin = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signInAdmin(email, password);
      setIsAdmin(true);
      setLogged?.(true);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    await signOutAdmin();
    setIsAdmin(false);
    setLogged?.(false);
    setJobs([]);
    setForm(emptyForm);
  };

  const persist = async (asUpdate) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (asUpdate && editingId) {
        await updatePendingJob(editingId, form);
        setMessage("Rascunho atualizado. A vaga permanece pendente de curadoria.");
      } else {
        const created = await createPendingJob(form);
        setEditingId(created.id);
        setMessage("Vaga cadastrada como pendente de curadoria.");
      }
      setForm(emptyForm);
      setEditingId("");
      await refresh();
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

  const loadJob = (job) => {
    setEditingId(job.id);
    setForm({
      title: job.title ?? "",
      companyId: job.company_id ?? "",
      newCompanyName: "",
      level: job.level === "junior" ? "Júnior" : job.level === "mid" ? "Pleno" : job.level === "senior" ? "Sênior" : "Estágio",
      description: job.description ?? "",
      stackText: (job.stack ?? []).join(", "),
      location: job.location ?? "",
      workModel: job.work_model === "hybrid" ? "Híbrido" : job.work_model === "onsite" ? "Presencial" : "Remoto",
    });
    setMessage(`Editando ${job.title} (${job.status}).`);
  };

  if (!ready) {
    return <main className="admin-page"><div className="shell admin-shell"><section className="admin-content"><p>Carregando área administrativa…</p></section></div></main>;
  }

  if (!isAdmin) {
    return <main className="admin-page"><div className="shell admin-shell"><aside className="admin-side"><button className="brand"><span className="brand-mark"><img src="/favicon.svg" alt="" /></span><span>GDG<span>Jobs</span></span></button></aside><section className="admin-content"><div className="admin-title"><div><span className="eyebrow">Área administrativa</span><h1>Entrar como administrador</h1><p>Use o e-mail e a senha do usuário de teste. Google OAuth fica para o Sprint 5.</p></div></div><form className="job-form" onSubmit={onLogin}><div className="form-section"><h2>Acesso</h2><div className="form-grid"><label className="wide">E-mail<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.invalid" /></label><label className="wide">Senha<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label></div></div>{error && <div className="success" role="alert">{error}</div>}<div className="form-actions"><button className="primary" type="submit" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button></div></form></section></div></main>;
  }

  return <main className="admin-page"><div className="shell admin-shell"><aside className="admin-side"><button className="brand"><span className="brand-mark"><img src="/favicon.svg" alt="" /></span><span>GDG<span>Jobs</span></span></button><div className="admin-user"><span className="avatar">AM</span><div><strong>Admin GDG</strong><small>administrador</small></div></div><nav><button className="active"><LayoutDashboard size={18}/> Visão geral</button><button type="button"><BriefcaseBusiness size={18}/> Vagas</button><button type="button"><Building2 size={18}/> Empresas</button></nav></aside><section className="admin-content"><div className="admin-title"><div><span className="eyebrow">Área administrativa</span><h1>Publicar nova vaga</h1><p>As vagas entram como pendentes e passam pela curadoria da comunidade.</p></div><button type="button" className="outline" onClick={onLogout}>Sair</button></div><div className="form-section"><h2>Vagas pending e approved</h2>{jobs.map((job) => <p key={job.id}><button type="button" className="ghost" onClick={() => loadJob(job)}>{job.title} — {job.status}{job.companies?.name ? ` · ${job.companies.name}` : ""}</button></p>)}{jobs.length === 0 && <p>Nenhuma vaga visível para este admin.</p>}</div><form className="job-form" onSubmit={onSubmit}><div className="form-section"><h2>Informações da vaga</h2><div className="form-grid"><label className="wide">Título da vaga<input required value={form.title} onChange={field("title")} placeholder="Ex.: Pessoa Desenvolvedora Front-end"/></label><label>Empresa<select value={form.companyId} onChange={field("companyId")}><option value="">Selecione uma empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label><label>Nova empresa fictícia<input value={form.newCompanyName} onChange={field("newCompanyName")} placeholder="Opcional se já selecionou"/></label><label>Nível<select required value={form.level} onChange={field("level")}><option value="">Selecione o nível</option><option>Júnior</option><option>Pleno</option><option>Sênior</option><option>Estágio</option></select></label><label className="wide">Descrição<textarea required value={form.description} onChange={field("description")} placeholder="Descreva a oportunidade, responsabilidades e requisitos..." rows="6"/></label></div></div><div className="form-section"><h2>Detalhes</h2><div className="form-grid"><label>Tecnologias<input value={form.stackText} onChange={field("stackText")} placeholder="React, TypeScript, Next.js"/></label><label>Localidade<input value={form.location} onChange={field("location")} placeholder="Ex.: Remoto · Brasil"/></label><label>Modelo<select value={form.workModel} onChange={field("workModel")}><option>Remoto</option><option>Híbrido</option><option>Presencial</option></select></label><label>Tipo de contrato<select defaultValue="CLT"><option>CLT</option><option>PJ</option><option>Estágio</option></select></label></div></div>{message && <div className="success"><Check size={18}/> {message}</div>}{error && <div className="success" role="alert">{error}</div>}<div className="form-actions"><button type="button" className="ghost" disabled={busy || !editingId} onClick={() => persist(true)}>Salvar rascunho</button><button className="primary" type="submit" disabled={busy}><Plus size={17}/> Cadastrar para curadoria</button></div></form></section></div></main>;
}
