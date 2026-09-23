import React, { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { countIngestionsNeedingAttention, loadAdminDashboardJobCounts } from "./admin-dashboard-api.js";
import { ADMIN_DASHBOARD_SKELETON_METRICS, summarizeAdminDashboard } from "./admin-dashboard.js";
import { canManageAdminJobs } from "./staff-access.js";

function DashboardSkeleton({ isAdmin }) {
  const items = isAdmin ? ADMIN_DASHBOARD_SKELETON_METRICS.slice(1) : [];
  return (
    <div className="admin-dashboard-loading" aria-busy="true" aria-label="Carregando indicadores do painel">
      <section className="admin-dashboard-focus" aria-hidden="true">
        <div>
          <p className="admin-dashboard-focus__eyebrow">Próxima ação</p>
          <h2>Curadoria</h2>
          <span className="admin-dashboard-skeleton-value" />
        </div>
      </section>
      {items.length ? <><h2 className="admin-dashboard-subheading" aria-hidden="true">Visão geral</h2>
        <dl className="admin-dashboard-stats" aria-hidden="true">
          {items.map((item) => (
            <div key={item.id} className="admin-dashboard-stat admin-dashboard-stat--skeleton">
              <dt>{item.label}</dt>
              <dd><span className="admin-dashboard-skeleton-value" /></dd>
            </div>
          ))}
        </dl></> : null}
      <p className="admin-dashboard-quiet" role="status">Carregando indicadores…</p>
    </div>
  );
}

export function AdminHome() {
  const { profile } = useOutletContext();
  const isAdmin = canManageAdminJobs(profile?.role);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [jobCounts, setJobCounts] = useState(null);
  const [ingestAttention, setIngestAttention] = useState(null);
  const [ingestError, setIngestError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setIngestError("");
    setJobCounts(null);
    setIngestAttention(null);

    loadAdminDashboardJobCounts({ isAdmin })
      .then((counts) => {
        if (cancelled) return;
        setJobCounts(counts);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Não foi possível carregar o resumo do painel.");
        setLoading(false);
      });

    if (!isAdmin) return () => {
      cancelled = true;
    };

    countIngestionsNeedingAttention()
      .then((count) => {
        if (!cancelled) setIngestAttention(count);
      })
      .catch((err) => {
        if (!cancelled) setIngestError(err.message || "Não foi possível contar as ingestões.");
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin, reloadToken]);

  const summary = summarizeAdminDashboard({
    isAdmin,
    ...(jobCounts ?? {}),
    ingestAttention: ingestAttention ?? 0,
  });
  const priorityMetric = summary.metrics[0];
  const secondaryMetrics = summary.metrics.slice(1);
  const curationCta = summary.ctas.find((cta) => cta.to === "/admin/curadoria");
  const otherCtas = summary.ctas.filter((cta) => cta.to !== "/admin/curadoria" && (ingestAttention != null || cta.to !== "/admin/ingestao"));

  return (
    <>
      <div className="admin-title">
        <div>
          <span className="eyebrow">Área de equipe</span>
          <h1>Painel</h1>
          <p>Comece pelo que precisa de atenção. As outras áreas estão no menu.</p>
        </div>
      </div>
      {error ? (
        <div className="form-alert" role="alert">
          <p>{error}</p>
          <button className="outline small" type="button" onClick={() => setReloadToken((value) => value + 1)}>Tentar novamente</button>
        </div>
      ) : null}
      {loading && !error ? <DashboardSkeleton isAdmin={isAdmin} /> : null}
      {!loading && !error ? (
        <>
          <section className="admin-dashboard-focus" aria-labelledby="admin-dashboard-focus-title">
            <div>
              <p className="admin-dashboard-focus__eyebrow">Próxima ação</p>
              <h2 id="admin-dashboard-focus-title">Curadoria</h2>
              <p>{priorityMetric.value > 0 ? `${priorityMetric.value} ${priorityMetric.value === 1 ? "vaga aguarda" : "vagas aguardam"} revisão` : "Fila de revisão em dia"}</p>
            </div>
            {curationCta ? <Link className="primary small" to={curationCta.to}>Revisar fila</Link> : <Link className="outline small" to="/admin/curadoria">Abrir curadoria</Link>}
          </section>
          {secondaryMetrics.length ? <>
          <h2 className="admin-dashboard-subheading">Visão geral</h2>
          <dl className="admin-dashboard-stats">
            {secondaryMetrics.map((metric) => {
              const ingestPending = metric.id === "ingest-attention" && ingestAttention == null && !ingestError;
              return (
                <div key={metric.id} className={ingestPending ? "admin-dashboard-stat admin-dashboard-stat--skeleton" : "admin-dashboard-stat"}>
                  <dt>{metric.label}</dt>
                  <dd aria-describedby={metric.hint ? `admin-metric-${metric.id}-hint` : undefined}>
                    {ingestPending ? <span className="admin-dashboard-skeleton-value" /> : metric.id === "ingest-attention" && ingestError ? "—" : metric.value}
                  </dd>
                  {metric.hint ? (
                    <p className="admin-dashboard-stat-hint" id={`admin-metric-${metric.id}-hint`}>{metric.hint}</p>
                  ) : null}
                </div>
              );
            })}
          </dl>
          </> : null}
          {ingestError ? (
            <div className="form-alert" role="alert">
              <p>{ingestError}</p>
              <button className="outline small" type="button" onClick={() => setReloadToken((value) => value + 1)}>Tentar novamente</button>
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
      ) : null}
    </>
  );
}
