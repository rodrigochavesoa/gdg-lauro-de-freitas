import React, { useEffect, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Check, ChevronRight, Clock, Database, FileText, X } from "lucide-react";
import { loadAdminDashboardSummary } from "./admin-dashboard-api.js";
import { describeAdminDashboardFocus, summarizeAdminDashboard } from "./admin-dashboard.js";
import { canManageAdminJobs } from "./staff-access.js";

const STAT_ICONS = {
  approved: FileText,
  "rejected-jobs": X,
  "rejected-queue": Clock,
  "ingest-attention": Database,
};

function FocusRing({ state, count }) {
  return (
    <div className={`admin-dashboard-ring admin-dashboard-ring--${state}`} aria-hidden="true">
      <svg viewBox="0 0 72 72" focusable="false">
        <circle cx="36" cy="36" r="28" className="admin-dashboard-ring__track" />
        {state === "attention" ? <circle cx="36" cy="36" r="28" className="admin-dashboard-ring__arc" /> : null}
      </svg>
      <span className="admin-dashboard-ring__value">
        {state === "attention" ? <strong>{count}</strong> : null}
        {state === "clear" ? <Check size={22} /> : null}
        {state === "loading" || state === "unavailable" ? <span className="admin-dashboard-skeleton-value" /> : null}
      </span>
    </div>
  );
}

function FocusSteps({ state }) {
  const attention = state === "attention";
  const statusLabel = attention ? "Atenção" : "Em dia";
  return (
    <ol
      className={`admin-dashboard-steps admin-dashboard-steps--${state}`}
      aria-label={attention ? "Situação: atenção necessária" : "Situação: em dia"}
    >
      <li className="admin-dashboard-steps__item admin-dashboard-steps__item--current">
        <span className="admin-dashboard-steps__dot" />
        <span className="admin-dashboard-steps__label">{statusLabel}</span>
      </li>
      <li className="admin-dashboard-steps__item admin-dashboard-steps__item--end" aria-hidden="true">
        <span className="admin-dashboard-steps__dot" />
      </li>
    </ol>
  );
}

export function AdminHome({ refreshKey = 0 }) {
  const { profile } = useOutletContext();
  const isAdmin = canManageAdminJobs(profile?.role);
  const [jobCounts, setJobCounts] = useState(null);
  const [ingestAttention, setIngestAttention] = useState(null);
  const [ingestUnavailable, setIngestUnavailable] = useState(false);
  const [jobsError, setJobsError] = useState("");
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
      setIngestUnavailable(false);
    }
    setJobsBusy(true);
    setIngestBusy(isAdmin);
    setJobsError("");

    loadAdminDashboardSummary({ isAdmin })
      .then((summary) => {
        if (cancelled) return;
        setJobCounts(summary);
        setIngestAttention(summary.ingestAttention);
        setIngestUnavailable(isAdmin && summary.ingestAvailable !== true);
        setJobsBusy(false);
        setIngestBusy(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setJobsError(err.message || "Não foi possível carregar o resumo do painel.");
        setJobsBusy(false);
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
  const focus = describeAdminDashboardFocus({
    isAdmin,
    pendingCuration: jobCounts ? jobCounts.pendingCuration : null,
    pendingJobs: jobCounts ? jobCounts.pendingJobs : null,
    ingestAttention,
    jobsFailed: Boolean(jobsError),
    ingestFailed: isAdmin && ingestUnavailable,
  });
  const secondaryMetrics = summary.metrics.slice(1);
  const otherCtas = summary.ctas.filter((cta) => {
    if (focus.href && cta.to === focus.href) return false;
    if (jobsError) return false;
    return true;
  });
  const unresolved = focus.state === "loading" || focus.state === "unavailable";
  const sectionBusy = jobsBusy || (focus.state === "loading" && ingestBusy);
  const retry = () => setReloadToken((value) => value + 1);

  return (
    <div className="admin-dashboard">
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
        className={`admin-dashboard-focus admin-dashboard-focus--${focus.state}`}
        aria-labelledby="admin-dashboard-focus-title"
        aria-busy={sectionBusy || undefined}
      >
        <FocusRing state={focus.state} count={focus.count} />
        <div className="admin-dashboard-focus__copy">
          <p className="admin-dashboard-focus__eyebrow">Próxima ação</p>
          <h2 id="admin-dashboard-focus-title">
            {unresolved ? <span className="sr-only">Próxima ação</span> : focus.title}
            {unresolved ? <span className="admin-dashboard-skeleton-value" aria-hidden="true" /> : null}
          </h2>
          {focus.detail ? <p aria-live="polite">{focus.detail}</p> : <span className="admin-dashboard-skeleton-value" aria-hidden="true" />}
        </div>
        {unresolved ? (
          <span className="admin-dashboard-skeleton-value admin-dashboard-steps-skeleton" aria-hidden="true" />
        ) : (
          <FocusSteps state={focus.state} />
        )}
        {focus.href ? (
          <Link className="primary small admin-dashboard-focus__cta" to={focus.href}>
            {focus.ctaLabel}
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        ) : unresolved ? (
          <span className="admin-dashboard-skeleton-value admin-dashboard-skeleton-action" aria-hidden="true" />
        ) : null}
      </section>
      {secondaryMetrics.length ? (
        <>
          <h2 className="admin-dashboard-subheading">Visão geral</h2>
          <dl className="admin-dashboard-stats">
            {secondaryMetrics.map((metric) => {
              const isIngest = metric.id === "ingest-attention";
              const busy = isIngest ? ingestBusy : jobsBusy;
              const unavailable = isIngest && ingestUnavailable && !busy;
              const pending = metric.value == null && !unavailable;
              const Icon = STAT_ICONS[metric.id];
              return (
                <div
                  key={metric.id}
                  className={pending ? `admin-dashboard-stat admin-dashboard-stat--${metric.id} admin-dashboard-stat--skeleton` : `admin-dashboard-stat admin-dashboard-stat--${metric.id}`}
                  aria-busy={busy || undefined}
                >
                  <dt>
                    {Icon ? (
                      <span className="admin-dashboard-stat__icon" aria-hidden="true">
                        <Icon size={16} />
                      </span>
                    ) : null}
                    <span>{metric.label}</span>
                  </dt>
                  <dd aria-describedby={metric.hint ? `admin-metric-${metric.id}-hint` : undefined}>
                    {unavailable ? "Indisponível" : pending ? <span className="admin-dashboard-skeleton-value" /> : metric.value}
                  </dd>
                  {unavailable ? (
                    <button className="outline small" type="button" onClick={retry}>Tentar novamente</button>
                  ) : null}
                  {metric.hint ? (
                    <p className="admin-dashboard-stat-hint" id={`admin-metric-${metric.id}-hint`}>{metric.hint}</p>
                  ) : null}
                </div>
              );
            })}
          </dl>
        </>
      ) : null}
      {otherCtas.length > 0 ? (
        <nav className="admin-dashboard-cta" aria-label="Outras ações pendentes no painel">
          {otherCtas.map((cta) => (
            <Link key={cta.to} className="outline small" to={cta.to}>
              {cta.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
