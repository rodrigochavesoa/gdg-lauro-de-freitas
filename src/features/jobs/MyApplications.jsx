import React, { useEffect, useRef, useState } from "react";
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

function applicationsFromPage(page) {
  return page?.applications ?? [];
}

export function MyApplications({ userId }) {
  const cached = peekMyApplicationsCache(userId);
  const [rows, setRows] = useState(() => applicationsFromPage(cached));
  const [hasMore, setHasMore] = useState(() => Boolean(cached?.hasMore));
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(() => (cached ? "ready" : "loading"));
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyJobId, setBusyJobId] = useState(null);
  const [error, setError] = useState("");
  const listGenerationRef = useRef(0);

  useEffect(() => {
    if (!userId) return undefined;
    const generation = ++listGenerationRef.current;
    let cancelled = false;
    const hadCache = peekMyApplicationsCache(userId) != null;
    if (!hadCache) {
      setStatus("loading");
      setError("");
      setHasMore(false);
      setPage(1);
    }

    loadMyApplications({ userId, forceRefresh: hadCache })
      .then((result) => {
        if (cancelled || generation !== listGenerationRef.current) return;
        setRows(applicationsFromPage(result));
        setHasMore(Boolean(result.hasMore));
        setPage(1);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled || generation !== listGenerationRef.current) return;
        setRows([]);
        setHasMore(false);
        setPage(1);
        setError(err.message || "Não foi possível carregar suas candidaturas.");
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, [userId]);

  const withdraw = async (jobId) => {
    const generation = ++listGenerationRef.current;
    setBusyJobId(jobId);
    setError("");
    try {
      const updated = await withdrawApplication(jobId);
      if (generation !== listGenerationRef.current) return;
      setRows((current) =>
        current.map((row) => (row.jobId === jobId ? { ...row, status: updated?.status ?? "withdrawn" } : row)),
      );
      if (userId) {
        const result = await loadMyApplications({ userId, forceRefresh: true });
        if (generation !== listGenerationRef.current) return;
        setRows(applicationsFromPage(result));
        setHasMore(Boolean(result.hasMore));
        setPage(1);
      }
    } catch (err) {
      if (generation !== listGenerationRef.current) return;
      setError(err.message || "Não é possível retirar esta candidatura.");
    } finally {
      if (generation === listGenerationRef.current) setBusyJobId(null);
    }
  };

  const loadMore = async () => {
    if (!userId || loadingMore || !hasMore || status !== "ready") return;
    const generation = ++listGenerationRef.current;
    setLoadingMore(true);
    setError("");
    try {
      const result = await loadMyApplications({ userId, page: page + 1 });
      if (generation !== listGenerationRef.current) return;
      setRows((current) => [...current, ...applicationsFromPage(result)]);
      setHasMore(Boolean(result.hasMore));
      setPage((current) => current + 1);
    } catch (err) {
      if (generation !== listGenerationRef.current) return;
      setError(err.message || "Não foi possível carregar mais candidaturas.");
    } finally {
      if (generation === listGenerationRef.current) setLoadingMore(false);
    }
  };

  const loading = status === "loading" && rows.length === 0;

  return (
    <main id="conteudo" tabIndex={-1} className="detail-page" aria-busy={loading}>
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
                      <Link to={`/jobs/${row.jobId}`} state={{ from: "/minhas-candidaturas" }}>{row.jobTitle || "Vaga"}</Link>
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
        {hasMore && status === "ready" ? (
          <div className="catalog-more">
            <button type="button" className="outline" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Carregando…" : "Carregar mais"}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
