import React, { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { loadAdminDashboardSummary } from "./admin-dashboard-api.js";
import { ADMIN_DASHBOARD_SKELETON_METRICS, summarizeAdminDashboard } from "./admin-dashboard.js";
import { canManageAdminJobs } from "./staff-access.js";

function DashboardSkeleton({ isAdmin }) {
  const items = useMemo(
    () => (isAdmin ? ADMIN_DASHBOARD_SKELETON_METRICS : ADMIN_DASHBOARD_SKELETON_METRICS.slice(0, 1)),
    [isAdmin],
  );
  return (
    <dl className="admin-dashboard-stats" aria-busy="true" aria-label="Carregando indicadores do painel">
      {items.map((item) => (
        <div key={item.id} className="admin-dashboard-stat admin-dashboard-stat--skeleton">
          <dt>{item.label}</dt>
          <dd><span className="admin-dashboard-skeleton-value" aria-hidden="true" /></dd>
        </div>
      ))}
      <p className="admin-dashboard-quiet" role="status">Carregando indicadores…</p>
    </dl>
  );
}

export function AdminHome() {
  const { profile } = useOutletContext();
  const isAdmin = canManageAdminJobs(profile?.role);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(() => summarizeAdminDashboard({ isAdmin }));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const counts = await loadAdminDashboardSummary({ isAdmin });
        if (cancelled) return;
        setSummary(summarizeAdminDashboard({ isAdmin, ...counts }));
      } catch (err) {
        if (!cancelled) setError(err.message || "Não foi possível carregar o resumo do painel.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  return (
    <>
      <div className="admin-title">
        <div>
          <span className="eyebrow">Área administrativa</span>
          <h1>Painel</h1>
          <p>Resumo operacional. Use a navegação superior para abrir curadoria, vagas ou ingestão.</p>
        </div>
      </div>
      {error ? (
        <div className="form-alert" role="alert">
          {error}
        </div>
      ) : null}
      {loading && !error ? <DashboardSkeleton isAdmin={isAdmin} /> : null}
      {!loading && !error ? (
        <>
          <dl className="admin-dashboard-stats">
            {summary.metrics.map((metric) => (
              <div key={metric.id} className="admin-dashboard-stat">
                <dt>{metric.label}</dt>
                <dd aria-describedby={metric.hint ? `admin-metric-${metric.id}-hint` : undefined}>{metric.value}</dd>
                {metric.hint ? (
                  <p className="admin-dashboard-stat-hint" id={`admin-metric-${metric.id}-hint`}>{metric.hint}</p>
                ) : null}
              </div>
            ))}
          </dl>
          {summary.ctas.length > 0 ? (
            <nav className="admin-dashboard-cta" aria-label="Ações pendentes no painel">
              {summary.ctas.map((cta) => (
                <Link key={cta.to} className="primary small" to={cta.to}>
                  {cta.label}
                </Link>
              ))}
            </nav>
          ) : (
            <p className="admin-dashboard-quiet" role="status">Nenhuma ação pendente no momento.</p>
          )}
        </>
      ) : null}
    </>
  );
}
