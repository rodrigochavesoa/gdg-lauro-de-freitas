import React, { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { loadCurationQueue } from "../curation/curation-api.js";
import { loadJobIngestions } from "../ingest/ingest-api.js";
import { loadAdminJobs } from "../../lib/admin-api.js";
import { summarizeAdminDashboard } from "./admin-dashboard.js";
import { canManageAdminJobs } from "./staff-access.js";

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
        const queueData = await loadCurationQueue({ includeRejected: isAdmin });
        const jobs = isAdmin ? await loadAdminJobs() : [];
        const ingestions = isAdmin ? await loadJobIngestions() : [];
        if (cancelled) return;
        setSummary(
          summarizeAdminDashboard({
            queue: queueData.queue ?? [],
            rejected: queueData.rejected ?? [],
            jobs,
            ingestions,
            isAdmin,
          }),
        );
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
      {loading ? <p role="status">Carregando indicadores…</p> : null}
      {error ? (
        <div className="form-alert" role="alert">
          {error}
        </div>
      ) : null}
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
