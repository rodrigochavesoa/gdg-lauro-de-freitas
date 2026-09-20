import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Plus } from "lucide-react";
import {
  createPendingJob,
  loadAdminJobs,
  loadCompanies,
  updatePendingJob,
  validateAdminJob,
} from "./lib/admin-api.js";
import { loadCurationProfile, signInCuration } from "./features/curation/curation-api.js";
import {
  enrollStaffTotp,
  getStaffMfaAssurance,
  isStaffMfaRequired,
  needsStaffMfaStep,
  staffMfaQrSrc,
  verifyStaffTotp,
} from "./features/auth/staff-mfa.js";
import { CurationQueue } from "./features/curation/CurationQueue.jsx";
import { CurationTimeline } from "./features/curation/CurationTimeline.jsx";
import { IngestPanel } from "./features/ingest/IngestPanel.jsx";
import { AutoResizeTextarea, TEXTAREA_LIMITS } from "./shared/ui/AutoResizeTextarea.jsx";

const STAFF_ROLES = new Set(["admin", "curator", "moderator"]);

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

function toCurationProfile(authProfile, session) {
  if (!session?.user || !STAFF_ROLES.has(authProfile?.role)) return null;
  return {
    id: authProfile.id ?? session.user.id,
    full_name: authProfile.full_name,
    role: authProfile.role,
    email: session.user.email ?? authProfile.email,
  };
}

/** DS-07 — mesma onda inferior de Login/Home (`fill: var(--color-surface)`). */
function AdminSurfaceCurve() {
  return (
    <svg className="login-panel__curve login-panel__curve--bottom" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path fill="var(--color-surface)" stroke="none" d="M-8 52 C 180 118 380 14 560 64 C 740 112 920 8 1100 58 C 1240 96 1360 22 1448 48 L 1448 128 L -8 128 Z" />
    </svg>
  );
}

function StaffMfaQr({ qrCode }) {
  const src = staffMfaQrSrc(qrCode);
  if (!src) return null;
  return <img className="admin-mfa-qr" alt="QR code do autenticador" src={src} />;
}

export function Admin({ setLogged, session, authReady = true, authProfile = null }) {
  const snapshotStaff = toCurationProfile(authProfile, session);
  const mfaRequiredAtBoot = isStaffMfaRequired();
  const [ready, setReady] = useState(() => Boolean(authReady) && !(mfaRequiredAtBoot && session));
  const [profile, setProfile] = useState(() => (authReady && !mfaRequiredAtBoot ? snapshotStaff : null));
  const [section, setSection] = useState(() => (snapshotStaff?.role === "admin" ? "jobs" : "curation"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [mfaPending, setMfaPending] = useState(null);
  const [mfaEnroll, setMfaEnroll] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [companies, setCompanies] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [formErrors, setFormErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [adminDataLoading, setAdminDataLoading] = useState(false);
  const staffBootId = useRef(null);
  const [curationMounted, setCurationMounted] = useState(() => {
    if (mfaRequiredAtBoot) return false;
    const role = snapshotStaff?.role;
    return role === "curator" || role === "moderator";
  });

  const isAdmin = profile?.role === "admin";
  const pendingJobs = useMemo(
    () => jobs.filter((job) => job.status === "pending"),
    [jobs],
  );
  const publishedJobs = useMemo(
    () => jobs.filter((job) => job.status === "approved"),
    [jobs],
  );
  const rejectedJobs = useMemo(
    () => jobs.filter((job) => job.status === "rejected"),
    [jobs],
  );

  const refreshAdmin = async () => {
    try {
      const [companyRows, jobRows] = await Promise.all([loadCompanies(), loadAdminJobs()]);
      setCompanies(companyRows);
      setJobs(jobRows);
      setError("");
    } catch (err) {
      setCompanies([]);
      setJobs([]);
      setError(err.message || "Não foi possível carregar as vagas da área administrativa.");
    }
  };

  useEffect(() => {
    if (!authReady) return undefined;
    let cancelled = false;

    const bootAdmin = (current) => {
      const isNew = staffBootId.current !== current.id;
      staffBootId.current = current.id;
      setProfile(current);
      setLogged?.(true);
      if (isNew) {
        setSection(current.role === "admin" ? "jobs" : "curation");
      }
      setReady(true);
      if (current.role !== "admin" || !isNew) return;
      setAdminDataLoading(true);
      void refreshAdmin().finally(() => {
        if (!cancelled) setAdminDataLoading(false);
      });
    };

    const clearSensitiveAuth = () => {
      setEmail("");
      setPassword("");
      setTotpCode("");
      setMfaPending(null);
      setMfaEnroll(null);
      setError("");
    };

    if (!session) {
      staffBootId.current = null;
      setProfile(null);
      setLogged?.(false);
      setJobs([]);
      setForm(emptyForm);
      setSection("curation");
      clearSensitiveAuth();
      setReady(true);
      return undefined;
    }

    const admitStaff = async (current) => {
      if (!isStaffMfaRequired()) {
        bootAdmin(current);
        return;
      }
      try {
        const assurance = await getStaffMfaAssurance();
        if (cancelled) return;
        if (needsStaffMfaStep(assurance)) {
          setProfile(null);
          setMfaPending({ profile: current, assurance });
          setReady(true);
          return;
        }
        setMfaPending(null);
        setMfaEnroll(null);
        bootAdmin(current);
      } catch (err) {
        if (cancelled) return;
        setProfile(null);
        setMfaPending(null);
        setError(err.message);
        setReady(true);
      }
    };

    const fromSnapshot = toCurationProfile(authProfile, session);
    if (fromSnapshot) {
      void admitStaff(fromSnapshot);
      return () => {
        cancelled = true;
      };
    }

    setReady(true);
    loadCurationProfile()
      .then((current) => {
        if (cancelled || !current) return;
        return admitStaff(current);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, authProfile, session, setLogged]);

  useEffect(() => {
    if (profile && section === "curation") setCurationMounted(true);
  }, [profile, section]);

  const field = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const onLogin = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const current = await signInCuration(email, password);
      if (isStaffMfaRequired()) {
        const assurance = await getStaffMfaAssurance();
        if (needsStaffMfaStep(assurance)) {
          setProfile(null);
          setMfaPending({ profile: current, assurance });
          return;
        }
      }
      setMfaPending(null);
      setMfaEnroll(null);
      setProfile(current);
      setLogged?.(true);
      setSection(current.role === "admin" ? "jobs" : "curation");
      if (current.role === "admin") {
        setAdminDataLoading(true);
        refreshAdmin().finally(() => setAdminDataLoading(false));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setEmail("");
      setPassword("");
      setBusy(false);
    }
  };

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
      setForm(emptyForm);
      setEditingId("");
      await refreshAdmin();
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

  const onEnrollMfa = async () => {
    setBusy(true);
    setError("");
    try {
      const enrolled = await enrollStaffTotp();
      setMfaEnroll(enrolled);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onVerifyMfa = async (event) => {
    event.preventDefault();
    const factorId = mfaEnroll?.factorId ?? mfaPending?.assurance?.verifiedTotp?.[0]?.id;
    if (!factorId) {
      setError("Cadastre um autenticador antes de confirmar o código.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await verifyStaffTotp({ factorId, code: totpCode });
      const current = mfaPending?.profile;
      setTotpCode("");
      setMfaEnroll(null);
      setMfaPending(null);
      if (!current) return;
      staffBootId.current = current.id;
      setProfile(current);
      setLogged?.(true);
      setSection(current.role === "admin" ? "jobs" : "curation");
      if (current.role === "admin") {
        setAdminDataLoading(true);
        refreshAdmin().finally(() => setAdminDataLoading(false));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const loadJob = (job) => {
    if (job.status !== "pending") {
      setMessage("Edite via nova rodada na Curadoria.");
      return;
    }
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
    setMessage(`Editando ${job.title}.`);
  };

  if (!ready) {
    return (
      <main id="conteudo" tabIndex={-1} className="admin-page">
        <div className="shell admin-auth-shell">
          <section className="admin-content">
            <p role="status">Carregando área administrativa…</p>
          </section>
        </div>
        <AdminSurfaceCurve />
      </main>
    );
  }

  if (!profile) {
    if (mfaPending) {
      const needsEnroll = !mfaEnroll && (mfaPending.assurance?.verifiedTotp?.length ?? 0) === 0;
      return (
        <main id="conteudo" tabIndex={-1} className="admin-page">
          <div className="shell admin-auth-shell">
            <section className="admin-content">
              <div className="admin-title">
                <div>
                  <span className="eyebrow">Área da comunidade</span>
                  <h1>Confirmar segundo fator</h1>
                  <p role="status">Confirme o segundo fator para acessar a área da equipe.</p>
                </div>
              </div>
              <form className="admin-auth-form" onSubmit={onVerifyMfa}>
                <div className="form-section">
                  <h2>Autenticador TOTP</h2>
                  {needsEnroll ? (
                    <div className="form-grid">
                      <p className="wide">Cadastre um aplicativo autenticador nesta conta de equipe. Não usamos SMS.</p>
                      <div className="form-actions">
                        <button className="primary" type="button" disabled={busy} onClick={onEnrollMfa}>
                          {busy ? "Gerando…" : "Gerar QR do autenticador"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="form-grid">
                      {mfaEnroll ? (
                        <>
                          <StaffMfaQr qrCode={mfaEnroll.qrCode} />
                          {mfaEnroll.secret ? (
                            <p className="wide admin-mfa-secret">
                              Chave manual (se não puder escanear o QR): <code>{mfaEnroll.secret}</code>
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <p className="wide">Digite o código de 6 dígitos do autenticador já cadastrado.</p>
                      )}
                      <label className="wide">
                        Código do autenticador
                        <input
                          id="admin-totp"
                          name="totp"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          pattern="[0-9]{6}"
                          maxLength={6}
                          required
                          value={totpCode}
                          onChange={(event) => setTotpCode(event.target.value)}
                        />
                      </label>
                    </div>
                  )}
                </div>
                {error && (
                  <div className="form-alert" role="alert">
                    {error}
                  </div>
                )}
                {!needsEnroll ? (
                  <div className="form-actions">
                    <button className="primary" type="submit" disabled={busy}>
                      {busy ? "Confirmando…" : "Confirmar código"}
                    </button>
                  </div>
                ) : null}
              </form>
            </section>
          </div>
          <AdminSurfaceCurve />
        </main>
      );
    }
    return (
      <main id="conteudo" tabIndex={-1} className="admin-page">
        <div className="shell admin-auth-shell">
          <section className="admin-content">
            <div className="admin-title">
              <div>
                <span className="eyebrow">Área da comunidade</span>
                <h1>Entrar para curadoria ou admin</h1>
                <p>Use o e-mail e a senha da sua conta de equipe GDG Jobs. Candidatos: acesse pelo <Link to="/login">Login</Link>.</p>
              </div>
            </div>
            <form className="admin-auth-form" onSubmit={onLogin}>
              <div className="form-section">
                <h2>Acesso</h2>
                <div className="form-grid">
                  <label className="wide">
                    E-mail
                    <input id="admin-email" name="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu-email@empresa.com" />
                  </label>
                  <label className="wide">
                    Senha
                    <input id="admin-password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </label>
                </div>
              </div>
              {error && (
                <div className="form-alert" role="alert">
                  {error}
                </div>
              )}
              <div className="form-actions">
                <button className="primary" type="submit" disabled={busy}>
                  {busy ? "Entrando…" : "Entrar"}
                </button>
              </div>
            </form>
          </section>
        </div>
        <AdminSurfaceCurve />
      </main>
    );
  }

  return (
    <main id="conteudo" tabIndex={-1} className="admin-page">
      <div className="shell admin-shell">
        <section className="admin-content">
          <div className="admin-tabs">
            <button type="button" className={section === "curation" ? "primary small" : "ghost"} onClick={() => setSection("curation")}>
              Curadoria
            </button>
            {isAdmin && (
              <button type="button" className={section === "jobs" ? "primary small" : "ghost"} onClick={() => setSection("jobs")}>
                Publicar vaga
              </button>
            )}
            {isAdmin && (
              <button type="button" className={section === "ingest" ? "primary small" : "ghost"} onClick={() => setSection("ingest")}>
                Ingestão
              </button>
            )}
          </div>
          {curationMounted ? (
            <div hidden={section !== "curation"}>
              <CurationQueue profile={profile} includeRejected={isAdmin} />
            </div>
          ) : null}
          {isAdmin && (
            <div hidden={section !== "jobs"}>
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
              <div className="form-section admin-job-list">
                <h2>Aguardando curadoria</h2>
                {adminDataLoading ? <p role="status">Carregando vagas da área administrativa…</p> : null}
                {pendingJobs.map((job) => (
                  <div key={job.id} className="admin-job-list-block">
                    <p>
                      <button type="button" className="ghost admin-job-list-item" onClick={() => loadJob(job)}>
                        <span className="featured">Pendente</span>
                        <span className="admin-job-list-title">{job.title}</span>
                        {job.companies?.name ? (
                          <span className="admin-job-list-meta"> · {job.companies.name}</span>
                        ) : null}
                      </button>
                    </p>
                    <CurationTimeline reviews={job.job_curation_reviews} />
                  </div>
                ))}
                {pendingJobs.length === 0 && !adminDataLoading && !error && <p role="status">Nenhuma vaga aguardando curadoria.</p>}
              </div>
              <details className="form-section admin-job-list">
                <summary>Vagas publicadas</summary>
                <p>Edite via nova rodada na Curadoria.</p>
                {publishedJobs.map((job) => (
                  <div key={job.id} className="admin-job-list-block">
                    <p className="ghost admin-job-list-item">
                      <span className="featured">Publicada</span>
                      <span className="admin-job-list-title">{job.title}</span>
                      {job.companies?.name ? (
                        <span className="admin-job-list-meta"> · {job.companies.name}</span>
                      ) : null}
                    </p>
                    <CurationTimeline reviews={job.job_curation_reviews} />
                  </div>
                ))}
                {publishedJobs.length === 0 && !adminDataLoading && !error && <p>Nenhuma vaga publicada.</p>}
              </details>
              <details className="form-section admin-job-list">
                <summary>Vagas rejeitadas</summary>
                <p>Histórico de pareceres (rubrica e motivo). Reenvio na aba Curadoria.</p>
                {rejectedJobs.map((job) => (
                  <div key={job.id} className="admin-job-list-block">
                    <p className="ghost admin-job-list-item">
                      <span className="featured">Rejeitada</span>
                      <span className="admin-job-list-title">{job.title}</span>
                      {job.companies?.name ? (
                        <span className="admin-job-list-meta"> · {job.companies.name}</span>
                      ) : null}
                    </p>
                    <CurationTimeline reviews={job.job_curation_reviews} />
                  </div>
                ))}
                {rejectedJobs.length === 0 && !adminDataLoading && !error && <p>Nenhuma vaga rejeitada.</p>}
              </details>
            </div>
          )}
          {isAdmin && section === "ingest" ? <IngestPanel /> : null}
        </section>
      </div>
      <AdminSurfaceCurve />
    </main>
  );
}
