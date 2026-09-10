import React, { useEffect, useState } from "react";
import { BriefcaseBusiness } from "lucide-react";
import { Link } from "react-router-dom";
import {
  applicationStatusLabel,
  canWithdrawStatus,
  formatApplicationDate,
  loadMyApplications,
  peekMyApplicationsCache,
  withdrawApplication,
} from "./apply-api.js";

function ApplicationSkeletons() {
  return (
    <div className="cards" aria-hidden="true">
      {[1, 2, 3].map((slot) => (
        <article key={slot} className="job-card job-card--skeleton job-card--skeleton-static" />
      ))}
    </div>
  );
}

export function MyApplications({ userId }) {
  const cached = peekMyApplicationsCache(userId);
  const [rows, setRows] = useState(() => cached ?? []);
  const [status, setStatus] = useState(() => (cached ? "ready" : "loading"));
  const [busyJobId, setBusyJobId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    const hadCache = peekMyApplicationsCache(userId) != null;
    if (!hadCache) {
      setStatus("loading");
      setError("");
    }

    loadMyApplications({ userId, forceRefresh: hadCache })
      .then((list) => {
        if (cancelled) return;
        setRows(list);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setRows([]);
        setError(err.message || "Não foi possível carregar suas candidaturas.");
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, [userId]);

  const withdraw = async (jobId) => {
    setBusyJobId(jobId);
    setError("");
    try {
      const updated = await withdrawApplication(jobId);
      setRows((current) =>
        current.map((row) => (row.jobId === jobId ? { ...row, status: updated?.status ?? "withdrawn" } : row)),
      );
      if (userId) {
        const list = await loadMyApplications({ userId, forceRefresh: true });
        setRows(list);
      }
    } catch (err) {
      setError(err.message || "Não é possível retirar esta candidatura.");
    } finally {
      setBusyJobId(null);
    }
  };

  const loading = status === "loading" && rows.length === 0;

  return (
    <main className="detail-page" aria-busy={loading}>
      <div className="shell">
        <h1>Minhas candidaturas</h1>
        {error ? <p className="tiny" role="alert">{error}</p> : null}
        {loading ? <ApplicationSkeletons /> : null}
        {status === "ready" && rows.length === 0 ? (
          <div className="empty">
            <BriefcaseBusiness size={32} />
            <h3>Você ainda não se candidatou</h3>
            <p>Explore as vagas aprovadas e envie seu perfil em um clique.</p>
            <Link className="outline" to="/vagas">Ver vagas</Link>
          </div>
        ) : null}
        {rows.length > 0 ? (
          <div className="cards">
            {rows.map((row) => (
              <article className="job-card" key={row.id || row.jobId}>
                <div className="job-main">
                  <div className="job-title">
                    <h3>
                      <Link to={`/jobs/${row.jobId}`}>{row.jobTitle || "Vaga"}</Link>
                    </h3>
                    <span className="featured">{applicationStatusLabel(row.status)}</span>
                  </div>
                  <p className="company-name">{row.companyName || "Empresa"}</p>
                  <div className="meta">
                    <span>{formatApplicationDate(row.updatedAt || row.createdAt)}</span>
                  </div>
                </div>
                <div className="job-side">
                  {canWithdrawStatus(row.status) ? (
                    <button
                      className="outline"
                      type="button"
                      disabled={busyJobId === row.jobId}
                      onClick={() => withdraw(row.jobId)}
                    >
                      {busyJobId === row.jobId ? "Retirando…" : "Retirar candidatura"}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}
