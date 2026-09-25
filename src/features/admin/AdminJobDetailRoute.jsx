import React, { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { formatStaffPrivilegedApiError } from "../../lib/staff-api-errors.js";
import { CurationTimeline } from "../curation/CurationTimeline.jsx";
import { loadAdminJob } from "../../lib/admin-api.js";
import { adminJobStatusLabel } from "./job-form-state.js";

export function AdminJobDetailRoute() {
  const { id } = useParams();
  const { search } = useLocation();
  const backQuery = new URLSearchParams(search).get("back");
  const backTo = `/admin/vagas${backQuery?.startsWith("?") && backQuery.length < 2048 ? backQuery : ""}`;
  const [job, setJob] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError("");
    loadAdminJob(id)
      .then((row) => {
        if (cancelled) return;
        setJob(row);
        setStatus(row ? "ready" : "missing");
      })
      .catch((err) => {
        if (cancelled) return;
        setJob(null);
        setStatus("error");
        setError(formatStaffPrivilegedApiError(err.message));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (status === "loading") {
    return <p role="status">Carregando vaga…</p>;
  }

  if (status === "missing" || status === "error") {
    return (
      <>
        <p role="status">Vaga não encontrada ou indisponível.</p>
        {error ? (
          <div className="form-alert" role="alert">
            {error}
          </div>
        ) : null}
        <div className="admin-home-actions">
          <Link className="ghost" to={backTo}>
            Voltar às vagas
          </Link>
        </div>
      </>
    );
  }

  const pending = job.status === "pending";

  return (
    <>
      <div className="admin-title">
        <div>
          <span className="eyebrow">Área administrativa</span>
          <h1>{job.title}</h1>
          <p>
            {job.companies?.name ? `${job.companies.name} · ` : ""}
            {adminJobStatusLabel(job.status)}
          </p>
        </div>
      </div>
      <div className="form-section admin-job-detail-body">
        <h2>Sobre a vaga</h2>
        {job.description ? <p>{job.description}</p> : null}
        <CurationTimeline reviews={job.job_curation_reviews} />
      </div>
      <div className="admin-home-actions">
        {pending ? (
          <Link className="primary small" to={`/admin/vagas/nova?editar=${encodeURIComponent(job.id)}`}>
            Editar rascunho
          </Link>
        ) : (
          <Link className="primary small" to="/admin/curadoria">
            Abrir curadoria
          </Link>
        )}
        <Link className="ghost" to={backTo}>
          Voltar às vagas
        </Link>
      </div>
      {pending ? null : <p className="admin-dashboard-quiet">Mudanças de vagas publicadas ou rejeitadas passam por uma nova rodada de curadoria.</p>}
    </>
  );
}
