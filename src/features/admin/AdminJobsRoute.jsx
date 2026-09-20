import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatStaffPrivilegedApiError } from "../auth/staff-mfa.js";
import { CurationTimeline } from "../curation/CurationTimeline.jsx";
import { loadAdminJobs } from "../../lib/admin-api.js";
import { adminJobStatusLabel } from "./job-form-state.js";

function JobListBlock({ job }) {
  const label = adminJobStatusLabel(job.status);
  return (
    <div className="admin-job-list-block">
      <p>
        <Link className="ghost admin-job-list-item" to={`/admin/vagas/${job.id}`}>
          <span className="featured">{label}</span>
          <span className="admin-job-list-title">{job.title}</span>
          {job.companies?.name ? <span className="admin-job-list-meta"> · {job.companies.name}</span> : null}
        </Link>
      </p>
      <CurationTimeline reviews={job.job_curation_reviews} />
    </div>
  );
}

export function AdminJobsRoute() {
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadAdminJobs()
      .then((rows) => {
        if (cancelled) return;
        setJobs(rows);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setJobs([]);
        setError(formatStaffPrivilegedApiError(err.message) || "Não foi possível carregar as vagas da área administrativa.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingJobs = useMemo(() => jobs.filter((job) => job.status === "pending"), [jobs]);
  const publishedJobs = useMemo(() => jobs.filter((job) => job.status === "approved"), [jobs]);
  const rejectedJobs = useMemo(() => jobs.filter((job) => job.status === "rejected"), [jobs]);

  return (
    <>
      <div className="admin-title">
        <div>
          <span className="eyebrow">Área administrativa</span>
          <h1>Gestão de vagas</h1>
          <p>Listas atuais da área admin. Busca, filtros e paginação ficam para a entrega seguinte.</p>
        </div>
      </div>
      {error ? (
        <div className="form-alert" role="alert">
          {error}
        </div>
      ) : null}
      <div className="form-section admin-job-list">
        <h2>Aguardando curadoria</h2>
        {loading ? <p role="status">Carregando vagas da área administrativa…</p> : null}
        {pendingJobs.map((job) => (
          <JobListBlock key={job.id} job={job} />
        ))}
        {pendingJobs.length === 0 && !loading && !error ? <p role="status">Nenhuma vaga aguardando curadoria.</p> : null}
      </div>
      <details className="form-section admin-job-list">
        <summary>Vagas publicadas</summary>
        <p>Edite via nova rodada na Curadoria.</p>
        {publishedJobs.map((job) => (
          <JobListBlock key={job.id} job={job} />
        ))}
        {publishedJobs.length === 0 && !loading && !error ? <p>Nenhuma vaga publicada.</p> : null}
      </details>
      <details className="form-section admin-job-list">
        <summary>Vagas rejeitadas</summary>
        <p>Histórico de pareceres (rubrica e motivo). Reenvio na Curadoria.</p>
        {rejectedJobs.map((job) => (
          <JobListBlock key={job.id} job={job} />
        ))}
        {rejectedJobs.length === 0 && !loading && !error ? <p>Nenhuma vaga rejeitada.</p> : null}
      </details>
    </>
  );
}
