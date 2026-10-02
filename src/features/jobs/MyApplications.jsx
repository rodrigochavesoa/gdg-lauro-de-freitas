import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, ChevronDown, Filter, Search } from "lucide-react";
import { Link } from "react-router-dom";
import {
  applicationStatusLabel,
  canWithdrawStatus,
  formatApplicationDate,
  loadMyApplications,
  peekMyApplicationsCache,
  withdrawApplication,
} from "./apply-api.js";
import { APPLICATION_STATUS_FILTER_OPTIONS, filterMyApplications } from "./filter-my-applications.js";

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

function BrowseWaveDivider() {
  return (
    <div className="home-divider" aria-hidden="true">
      <svg className="home-divider__curve" viewBox="0 0 1440 120" preserveAspectRatio="none" focusable="false">
        <path fill="var(--color-surface)" stroke="none" d="M-8 52 C 180 118 380 14 560 64 C 740 112 920 8 1100 58 C 1240 96 1360 22 1448 48 L 1448 128 L -8 128 Z" />
      </svg>
    </div>
  );
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
  const [query, setQuery] = useState("");
  const [queryDraft, setQueryDraft] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [rowsUserId, setRowsUserId] = useState(userId);
  const listGenerationRef = useRef(0);

  if (rowsUserId !== userId) {
    const nextCache = userId ? peekMyApplicationsCache(userId) : null;
    setRowsUserId(userId);
    setRows(applicationsFromPage(nextCache));
    setHasMore(Boolean(nextCache?.hasMore));
    setPage(1);
    setError("");
    setLoadingMore(false);
    setBusyJobId(null);
    setStatus(nextCache ? "ready" : "loading");
  }

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
        setError(err.message || "Não foi possível carregar suas candidaturas.");
        if (hadCache) {
          setStatus("ready");
          return;
        }
        setRows([]);
        setHasMore(false);
        setPage(1);
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
  const visibleRows = useMemo(
    () => filterMyApplications(rows, { query, status: statusFilter }),
    [rows, query, statusFilter],
  );
  const catalogEmpty = status === "ready" && rows.length === 0;
  const filterEmpty = status === "ready" && rows.length > 0 && visibleRows.length === 0;
  const activeFilterCount = statusFilter ? 1 : 0;

  return (
    <main id="conteudo" tabIndex={-1} className="community-page community-page--browse" aria-busy={loading}>
      <section className="hero community-browse-hero" aria-labelledby="my-applications-browse-title">
        <div className="shell hero-content">
          <span className="eyebrow"><BriefcaseBusiness size={16} aria-hidden="true" /> Suas vagas</span>
          <h1 id="my-applications-browse-title">Minhas <em>candidaturas</em></h1>
          <p>Busque pelo título da vaga, pela empresa ou pelo status e acompanhe o que você já enviou.</p>
          <form
            className="searchbox community-browse-searchbox"
            role="search"
            aria-label="Buscar candidaturas"
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(queryDraft.trim());
            }}
          >
            <Search size={21} aria-hidden="true" />
            <input
              type="search"
              name="applications-query"
              value={queryDraft}
              disabled={loading}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder="Título da vaga, empresa ou status"
              aria-label="Título da vaga, empresa ou status"
            />
            <button className="primary" type="submit" disabled={loading}>
              Buscar candidaturas <ArrowUpRight size={17} aria-hidden="true" />
            </button>
          </form>
        </div>
      </section>
      <BrowseWaveDivider />
      <div className="shell community-shell">
        {error ? <p className="tiny" role="alert">{error}</p> : null}
        <div className="community-browse-toolbar">
          <button
            type="button"
            className="outline community-browse-filters-toggle"
            aria-expanded={filtersOpen}
            aria-controls="my-applications-filters-panel"
            disabled={loading}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <Filter size={16} aria-hidden="true" />
            Filtros
            {activeFilterCount > 0 ? <b>{activeFilterCount}</b> : null}
          </button>
          {filtersOpen ? (
            <div id="my-applications-filters-panel" className="community-browse-filters-panel" role="group" aria-label="Filtros das candidaturas">
              <label className="community-browse-select">
                <span className="community-browse-select__label">Status da candidatura</span>
                <select
                  className="community-browse-select__control"
                  name="applications-status"
                  value={statusFilter}
                  disabled={loading}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="Filtrar por status da candidatura"
                >
                  {APPLICATION_STATUS_FILTER_OPTIONS.map((option) => (
                    <option key={option.value || "all-statuses"} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="community-browse-select__chevron" aria-hidden="true" />
              </label>
            </div>
          ) : null}
        </div>
        {(query || statusFilter) && hasMore ? (
          <p className="tiny">A busca e o filtro usam só as candidaturas já carregadas. Carregue mais para incluir as próximas.</p>
        ) : null}
        {loading ? <ApplicationSkeletons /> : null}
        {catalogEmpty ? (
          <div className="empty">
            <BriefcaseBusiness size={32} />
            <h3>Você ainda não se candidatou</h3>
            <p>Explore as vagas aprovadas e envie seu perfil em um clique.</p>
            <Link className="outline" to="/vagas">Ver vagas</Link>
          </div>
        ) : null}
        {filterEmpty ? (
          <div className="empty">
            <h3>Nenhuma candidatura encontrada</h3>
            <p>
              {hasMore
                ? "Nenhuma das candidaturas já carregadas corresponde. Carregue mais para ampliar a busca."
                : "Ajuste a busca ou o filtro de status para ver outras candidaturas."}
            </p>
          </div>
        ) : null}
        {visibleRows.length > 0 ? (
          <div className="cards">
            {visibleRows.map((row) => (
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
