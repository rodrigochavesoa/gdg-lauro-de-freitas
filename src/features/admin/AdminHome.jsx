import React, { useEffect, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { countIngestionsNeedingAttention, loadAdminDashboardJobCounts } from "./admin-dashboard-api.js";
import { summarizeAdminDashboard } from "./admin-dashboard.js";
import { canManageAdminJobs } from "./staff-access.js";

function focusCopy(value) {
  if (typeof value !== "number") return null;
  if (value > 0) return `${value} ${value === 1 ? "vaga aguarda" : "vagas aguardam"} revisão`;
  return "Fila de revisão em dia";
}

export function AdminHome({ refreshKey = 0 }) {
  const { profile } = useOutletContext();
  const isAdmin = canManageAdminJobs(profile?.role);
  const [jobCounts, setJobCounts] = useState(null);
  const [ingestAttention, setIngestAttention] = useState(null);
  const [jobsError, setJobsError] = useState("");
  const [ingestError, setIngestError] = useState("");
  const [jobsBusy, setJobsBusy] = useState(true);
  const [ingestBusy, setIngestBusy] = useState(isAdmin);
  const [reloadToken, setReloadToken] = useState(0);
  const adminRef = useRef(isAdmin);

  useEffect(() => {
    let cancelled = false;
    const adminChanged = adminRef.current !== isAdmin;
    adminRef.current = isAdmin;
    if (adminChanged) {
      setJobCounts(null);
      setIngestAttention(null);
    }
    setJobsBusy(true);
    setJobsError("");
    setIngestError("");

    loadAdminDashboardJobCounts({ isAdmin })
      .then((counts) => {
        if (cancelled) return;
        setJobCounts(counts);
        setJobsBusy(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setJobsError(err.message || "Não foi possível carregar o resumo do painel.");
        setJobsBusy(false);
      });

    if (!isAdmin) {
      setIngestBusy(false);
      return () => {
        cancelled = true;
      };
    }

    setIngestBusy(true);
    countIngestionsNeedingAttention()
      .then((count) => {
        if (cancelled) return;
        setIngestAttention(count);
        setIngestBusy(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setIngestError(err.message || "Não foi possível contar as ingestões.");
        setIngestBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin, reloadToken, refreshKey]);

  const summary = summarizeAdminDashboard({
    isAdmin,
    pendingCuration: jobCounts ? jobCounts.pendingCuration : null,
    approved: jobCounts ? jobCounts.approved : null,
    rejectedJobs: jobCounts ? jobCounts.rejectedJobs : null,
    rejectedQueue: jobCounts ? jobCounts.rejectedQueue : null,
    pendingJobs: jobCounts ? jobCounts.pendingJobs : null,
    ingestAttention,
  });
  const priorityMetric = summary.metrics[0];
  const secondaryMetrics = summary.metrics.slice(1);
  const curationCta = summary.ctas.find((cta) => cta.to === "/admin/curadoria");
  const otherCtas = summary.ctas.filter((cta) => cta.to !== "/admin/curadoria");
  const priorityText = focusCopy(priorityMetric.value);
  const retry = () => setReloadToken((value) => value + 1);

  return (
    <>
      <div className="admin-title">
        <div>
          <span className="eyebrow">Área de equipe</span>
          <h1>Painel</h1>
          <p>Comece pelo que precisa de atenção. As outras áreas estão no menu.</p>
        </div>
      </div>
      {jobsError ? (
        <div className="form-alert" role="alert">
          <p>{jobsError}</p>
          <button className="outline small" type="button" onClick={retry}>Tentar novamente</button>
        </div>
      ) : null}
      <section
        className="admin-dashboard-focus"
        aria-labelledby="admin-dashboard-focus-title"
        aria-busy={jobsBusy || undefined}
      >
        <div>
          <p className="admin-dashboard-focus__eyebrow">Próxima ação</p>
          <h2 id="admin-dashboard-focus-title">Curadoria</h2>
          {priorityText ? <p>{priorityText}</p> : <span className="admin-dashboard-skeleton-value" />}
        </div>
        {curationCta ? (
          <Link className="primary small" to={curationCta.to}>Revisar fila</Link>
        ) : priorityMetric.value === 0 ? (
          <Link className="outline small" to="/admin/curadoria">Abrir curadoria</Link>
        ) : (
          <span className="admin-dashboard-skeleton-value admin-dashboard-skeleton-action" aria-hidden="true" />
        )}
      </section>
      {secondaryMetrics.length ? (
        <>
          <h2 className="admin-dashboard-subheading">Visão geral</h2>
          <dl className="admin-dashboard-stats">
            {secondaryMetrics.map((metric) => {
              const isIngest = metric.id === "ingest-attention";
              const busy = isIngest ? ingestBusy : jobsBusy;
              const pending = metric.value == null && !(isIngest && ingestError);
              return (
                <div
                  key={metric.id}
                  className={pending ? "admin-dashboard-stat admin-dashboard-stat--skeleton" : "admin-dashboard-stat"}
                  aria-busy={busy || undefined}
                >
                  <dt>{metric.label}</dt>
                  <dd aria-describedby={metric.hint ? `admin-metric-${metric.id}-hint` : undefined}>
                    {pending ? <span className="admin-dashboard-skeleton-value" /> : isIngest && ingestError && metric.value == null ? "—" : metric.value}
                  </dd>
                  {metric.hint ? (
                    <p className="admin-dashboard-stat-hint" id={`admin-metric-${metric.id}-hint`}>{metric.hint}</p>
                  ) : null}
                </div>
              );
            })}
          </dl>
        </>
      ) : null}
      {ingestError ? (
        <div className="form-alert" role="alert">
          <p>{ingestError}</p>
          <button className="outline small" type="button" onClick={retry}>Tentar novamente</button>
        </div>
      ) : null}
      {otherCtas.length > 0 ? (
        <nav className="admin-dashboard-cta" aria-label="Ações pendentes no painel">
          {otherCtas.map((cta) => (
            <Link key={cta.to} className="outline small" to={cta.to}>
              {cta.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </>
  );
}
