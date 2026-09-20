import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import {
  ADMIN_JOB_PAGE_SIZE,
  ADMIN_JOB_SORT_OLDEST,
  ADMIN_JOB_SORT_RECENT,
  adminJobListSearchParams,
  loadAdminJobPage,
  parseAdminJobListSearch,
} from "./admin-jobs-api.js";
import { adminJobStatusLabel } from "./job-form-state.js";

const STATUS_FILTERS = [
  { id: "pending", label: "Pendentes" },
  { id: "approved", label: "Publicadas" },
  { id: "rejected", label: "Rejeitadas" },
];

function mergeJobsById(current, incoming) {
  const seen = new Set(current.map((job) => String(job.id)));
  const extra = incoming.filter((job) => !seen.has(String(job.id)));
  return [...current, ...extra];
}

function listHeading(status) {
  if (status === "approved") return "Vagas publicadas";
  if (status === "rejected") return "Vagas rejeitadas";
  return "Aguardando curadoria";
}

function emptyCopy(status) {
  if (status === "approved") return "Nenhuma vaga publicada.";
  if (status === "rejected") return "Nenhuma vaga rejeitada.";
  return "Nenhuma vaga aguardando curadoria.";
}

function JobListRow({ job }) {
  const label = adminJobStatusLabel(job.status);
  return (
    <p>
      <Link className="ghost admin-job-list-item" to={`/admin/vagas/${job.id}`}>
        <span className="featured">{label}</span>
        {job.featured ? <span className="featured">Destaque</span> : null}
        <span className="admin-job-list-title">{job.title}</span>
        {job.companies?.name ? <span className="admin-job-list-meta"> · {job.companies.name}</span> : null}
      </Link>
    </p>
  );
}

export function AdminJobsRoute() {
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

  const heading = listHeading(filters.status);
  const shownCount = total ?? items.length;
  const loadingAnnouncement =
    listStatus === "loading" && items.length === 0 ? "Carregando vagas da área administrativa…" : "";

  return (
    <>
      <div className="admin-title">
        <div>
          <span className="eyebrow">Área administrativa</span>
          <h1>Gestão de vagas</h1>
          <p>Busca, filtro de status e paginação no servidor. O histórico de curadoria fica no detalhe da vaga.</p>
        </div>
      </div>

      <form className="admin-jobs-search" role="search" aria-label="Buscar vagas na gestão" onSubmit={applyQuery}>
        <Search size={18} aria-hidden="true" />
        <input
          id="admin-jobs-query"
          name="q"
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
          placeholder="Título ou empresa"
          aria-label="Título ou empresa"
        />
        <button className="primary small" type="submit">
          Buscar
        </button>
      </form>

      <div className="admin-jobs-toolbar-row">
        <div className="admin-jobs-status" role="group" aria-label="Status da vaga">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="ghost small"
              aria-pressed={filters.status === item.id}
              onClick={() => commitFilters({ status: item.id, page: 1 })}
            >
              {item.label}
            </button>
          ))}
        </div>
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

      {error ? (
        <div className="form-alert" role="alert">
          <p>{error}</p>
          <button type="button" className="outline small" onClick={retry}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      <div className="form-section admin-job-list">
        <div className="admin-jobs-toolbar-row">
          <h2>{heading}</h2>
          {shownCount != null && listStatus === "ready" ? (
            <p className="admin-jobs-count" aria-live="polite">
              {shownCount === 1 ? "1 vaga" : `${shownCount} vagas`}
            </p>
          ) : null}
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
                className="admin-job-list-block job-card--skeleton job-card--skeleton-static admin-jobs-skeleton"
                aria-hidden="true"
              />
            ))
          : null}
        {items.map((job) => (
          <div key={job.id} className="admin-job-list-block">
            <JobListRow job={job} />
          </div>
        ))}
        {listStatus === "ready" && items.length === 0 && !error ? <p role="status">{emptyCopy(filters.status)}</p> : null}
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
    </>
  );
}
