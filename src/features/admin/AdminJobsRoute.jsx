import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Filter, Search } from "lucide-react";
import { FilterSheet } from "../../shared/ui/FilterSheet.jsx";
import {
  ADMIN_JOB_PAGE_SIZE,
  ADMIN_JOB_SORT_OLDEST,
  ADMIN_JOB_SORT_RECENT,
  ADMIN_JOB_STATUS_FILTERS,
  adminJobEmptyCopy,
  adminJobListHeading,
  adminJobListSearchParams,
  countAdminJobActiveFilters,
  formatAdminJobTotalLabel,
  loadAdminJobPage,
  parseAdminJobListSearch,
} from "./admin-jobs-api.js";
import { adminJobStatusLabel } from "./job-form-state.js";

function mergeJobsById(current, incoming) {
  const seen = new Set(current.map((job) => String(job.id)));
  const extra = incoming.filter((job) => !seen.has(String(job.id)));
  return [...current, ...extra];
}

function StatusFilterGroup({ status, onSelect }) {
  return (
    <div className="admin-jobs-status" role="group" aria-label="Status da vaga">
      {ADMIN_JOB_STATUS_FILTERS.map((item) => (
        <button
          key={item.id}
          type="button"
          className="ghost small"
          aria-pressed={status === item.id}
          onClick={() => onSelect(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function SortFilterGroup({ sort, onSelect }) {
  return (
    <div className="admin-jobs-sort-options" role="group" aria-label="Ordenar vagas">
      <button
        type="button"
        className="ghost small"
        aria-pressed={sort === ADMIN_JOB_SORT_RECENT}
        onClick={() => onSelect(ADMIN_JOB_SORT_RECENT)}
      >
        Mais recentes
      </button>
      <button
        type="button"
        className="ghost small"
        aria-pressed={sort === ADMIN_JOB_SORT_OLDEST}
        onClick={() => onSelect(ADMIN_JOB_SORT_OLDEST)}
      >
        Mais antigas
      </button>
    </div>
  );
}

function JobListRow({ job, returnSearch }) {
  const label = adminJobStatusLabel(job.status);
  const company = job.companies?.name;
  return (
    <article className="admin-job-card">
      <Link className="admin-job-card__link" to={`/admin/vagas/${job.id}${returnSearch ? `?back=${encodeURIComponent(returnSearch)}` : ""}`}>
        <div className="admin-job-card__body">
          <h3 className="admin-job-list-title">{job.title}</h3>
          {company ? <p className="admin-job-list-meta">{company}</p> : null}
        </div>
        <div className="admin-job-card__badges">
          <span className="admin-job-status">{label}</span>
        </div>
      </Link>
    </article>
  );
}

export function AdminJobsRoute() {
  const { search } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseAdminJobListSearch(searchParams), [searchParams]);
  const [queryInput, setQueryInput] = useState(() => filters.query);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(null);
  const [hasNext, setHasNext] = useState(false);
  const [listStatus, setListStatus] = useState("loading");
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const closeFilters = useCallback(() => setFilterOpen(false), []);

  useEffect(() => {
    setQueryInput((current) => (current === filters.query ? current : filters.query));
  }, [filters.query]);

  useEffect(() => {
    let cancelled = false;
    const append = filters.page > 1;
    if (append) {
      setLoadingMore(true);
    } else {
      setListStatus("loading");
      setItems([]);
      setTotal(null);
      setHasNext(false);
    }

    loadAdminJobPage({
      status: filters.status,
      query: filters.query,
      sort: filters.sort,
      page: filters.page,
      pageSize: filters.pageSize,
    })
      .then((page) => {
        if (cancelled) return;
        setItems((current) => (append ? mergeJobsById(current, page.items) : page.items));
        setTotal(page.total);
        setHasNext(page.hasNext);
        setError("");
        setListStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        if (!append) setItems([]);
        setHasNext(false);
        setError(err.message || "Não foi possível carregar as vagas da área administrativa.");
        setListStatus("error");
      })
      .finally(() => {
        if (!cancelled) setLoadingMore(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters.page, filters.pageSize, filters.query, filters.sort, filters.status, reloadToken]);

  const commitFilters = (patch) => {
    const next = {
      status: patch.status ?? filters.status,
      query: patch.query ?? filters.query,
      sort: patch.sort ?? filters.sort,
      page: patch.page ?? 1,
    };
    setSearchParams(adminJobListSearchParams(next), { replace: true });
  };

  const applyQuery = (event) => {
    event.preventDefault();
    commitFilters({ query: queryInput, page: 1 });
  };

  const loadMore = () => {
    if (loadingMore || listStatus !== "ready" || !hasNext) return;
    commitFilters({ page: filters.page + 1 });
  };

  const retry = () => {
    setError("");
    setReloadToken((token) => token + 1);
  };

  const resetSheetFilters = () => {
    commitFilters({ status: "pending", sort: ADMIN_JOB_SORT_RECENT, page: 1 });
  };

  const heading = adminJobListHeading(filters.status);
  const countLabel =
    listStatus === "ready"
      ? formatAdminJobTotalLabel(total, items.length)
      : listStatus === "loading" && items.length === 0
        ? "Carregando…"
        : "\u00a0";
  const activeFilterCount = countAdminJobActiveFilters(filters);
  const sheetCount = total ?? items.length;
  const busy = (listStatus === "loading" && items.length === 0) || loadingMore;
  const loadingAnnouncement =
    listStatus === "loading" && items.length === 0
      ? "Carregando vagas da área administrativa…"
      : loadingMore
        ? "Carregando mais vagas…"
        : "";

  return (
    <div className="admin-jobs-layout">
      <div className="admin-title">
        <div>
          <span className="eyebrow">Área administrativa</span>
          <h1>Gestão de vagas</h1>
          <p>Encontre uma vaga e abra o detalhe para acompanhar o histórico.</p>
        </div>
      </div>

      <FilterSheet
        open={filterOpen}
        onClose={closeFilters}
        resultCount={sheetCount}
        titleId="admin-jobs-filters-title"
      >
        <div className="filter-head">
          <h2 id="admin-jobs-filters-title">
            <Filter size={18} /> Filtros
          </h2>
          <button type="button" onClick={resetSheetFilters}>
            Limpar
          </button>
        </div>
        <div className="filters__body">
          <div className="filter-group">
            <h3>Status</h3>
            <StatusFilterGroup status={filters.status} onSelect={(status) => commitFilters({ status, page: 1 })} />
          </div>
          <div className="filter-group">
            <h3>Ordenar</h3>
            <SortFilterGroup sort={filters.sort} onSelect={(sort) => commitFilters({ sort, page: 1 })} />
          </div>
        </div>
      </FilterSheet>

      <form className="searchbox admin-jobs-searchbox" role="search" aria-label="Buscar vagas na gestão" onSubmit={applyQuery}>
        <Search size={21} aria-hidden="true" />
        <input
          id="admin-jobs-query"
          name="q"
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
          placeholder="Título ou empresa"
          aria-label="Título ou empresa"
        />
        <button className="primary" type="submit">
          Buscar
        </button>
      </form>

      {error ? (
        <div className="form-alert" role="alert">
          <p>{error}</p>
          <button type="button" className="outline small" onClick={retry}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      <div className="admin-job-list" aria-busy={busy ? "true" : undefined}>
        <div className="result-head admin-jobs-result-head">
          <div>
            <h2>{heading}</h2>
            <p className="admin-jobs-count" aria-live="polite">
              {countLabel}
            </p>
          </div>
          <button
            className="filter-mobile"
            type="button"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen(true)}
          >
            <Filter size={16} /> Filtros {activeFilterCount > 0 ? <b>{activeFilterCount}</b> : null}
          </button>
        </div>
        <div className="admin-jobs-toolbar-row admin-jobs-toolbar--desktop">
          <StatusFilterGroup status={filters.status} onSelect={(status) => commitFilters({ status, page: 1 })} />
          <label className="admin-jobs-sort" htmlFor="admin-jobs-sort">
            Ordenar
            <select
              id="admin-jobs-sort"
              name="sort"
              value={filters.sort}
              onChange={(event) => commitFilters({ sort: event.target.value, page: 1 })}
            >
              <option value={ADMIN_JOB_SORT_RECENT}>Mais recentes</option>
              <option value={ADMIN_JOB_SORT_OLDEST}>Mais antigas</option>
            </select>
          </label>
        </div>
        {loadingAnnouncement ? (
          <p className="sr-only" role="status">
            {loadingAnnouncement}
          </p>
        ) : null}
        {listStatus === "loading" && items.length === 0
          ? [1, 2, 3, 4].map((slot) => (
              <div
                key={slot}
                className="admin-job-card admin-jobs-skeleton job-card--skeleton job-card--skeleton-static"
                aria-hidden="true"
              />
            ))
          : null}
        {items.map((job) => (
          <JobListRow key={job.id} job={job} returnSearch={search} />
        ))}
        {listStatus === "ready" && items.length === 0 && !error ? <p role="status">{adminJobEmptyCopy(filters.status)}</p> : null}
      </div>

      {hasNext && listStatus === "ready" ? (
        <div className="admin-jobs-more">
          <button type="button" className="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Carregando…" : "Carregar mais"}
          </button>
        </div>
      ) : null}
      <p className="sr-only">
        Página {filters.page}, {ADMIN_JOB_PAGE_SIZE} por página. Status {filters.status}.
      </p>
    </div>
  );
}
