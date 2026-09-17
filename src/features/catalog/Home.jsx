import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight, BadgeCheck, BriefcaseBusiness,
  Check, ChevronDown, CircleDollarSign, Filter,
  MapPin, Search, Sparkles, Users
} from "lucide-react";
import { FilterSheet } from "../../shared/ui/FilterSheet.jsx";
import {
  CATALOG_LEVELS,
  CATALOG_TECHNOLOGIES,
  CATALOG_WORK_MODELS,
  SORT_OLDEST,
  SORT_RECENT,
  formOptionId,
  toggleFilterValue,
} from "../../lib/filter-jobs.js";
import { loadApprovedJobs, peekApprovedJobsPage } from "./jobs-api.js";
import { Link, useSearchParams } from "react-router-dom";

function mergeJobsById(current, incoming) {
  const seen = new Set(current.map((job) => String(job.id)));
  const extra = incoming.filter((job) => !seen.has(String(job.id)));
  return [...current, ...extra];
}

function peekHomeCatalog(query) {
  return peekApprovedJobsPage({
    query: query ?? "",
    tech: [],
    level: [],
    workModel: [],
    sort: SORT_RECENT,
  });
}

export function Home({ logged = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get("query") ?? "";
  const [query, setQuery] = useState(() => urlQuery);
  const [tech, setTech] = useState([]);
  const [level, setLevel] = useState([]);
  const [workModel, setWorkModel] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState(SORT_RECENT);
  const [jobs, setJobs] = useState(() => peekHomeCatalog(searchParams.get("query"))?.jobs ?? []);
  const [resultCount, setResultCount] = useState(() => peekHomeCatalog(searchParams.get("query"))?.count ?? null);
  const [catalogStatus, setCatalogStatus] = useState(() => (peekHomeCatalog(searchParams.get("query")) ? "ready" : "loading"));
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setQuery((current) => (current === urlQuery ? current : urlQuery));
  }, [urlQuery]);

  useEffect(() => {
    let cancelled = false;
    const peeked = peekApprovedJobsPage({ query, tech, level, workModel, sort: sortOrder });
    if (peeked) {
      setJobs(peeked.jobs);
      setResultCount(peeked.count);
      setCatalogStatus("ready");
    } else {
      setJobs([]);
      setResultCount(null);
      setCatalogStatus("loading");
    }
    setLoadingMore(false);

    loadApprovedJobs({ query, tech, level, workModel, sort: sortOrder, offset: 0 })
      .then((page) => {
        if (cancelled) return;
        setJobs(page.jobs);
        setResultCount(page.count);
        setCatalogStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setJobs([]);
        setResultCount(0);
        setCatalogStatus("error");
      });
    return () => { cancelled = true; };
  }, [query, tech, level, workModel, sortOrder]);

  const loadMore = async () => {
    if (loadingMore || catalogStatus !== "ready") return;
    if (resultCount != null && jobs.length >= resultCount) return;
    setLoadingMore(true);
    try {
      const page = await loadApprovedJobs({
        query,
        tech,
        level,
        workModel,
        sort: sortOrder,
        offset: jobs.length,
      });
      setJobs((current) => mergeJobsById(current, page.jobs));
      setResultCount(page.count);
    } catch {
      /* mantém a lista já carregada */
    } finally {
      setLoadingMore(false);
    }
  };

  const toggle = (item, values, setter) => setter(toggleFilterValue(item, values));
  const commitQueryToUrl = (nextQuery) => {
    const trimmed = String(nextQuery ?? "").trim();
    const current = searchParams.get("query") ?? "";
    if (trimmed === current) return;
    const next = new URLSearchParams(searchParams);
    if (trimmed) next.set("query", trimmed);
    else next.delete("query");
    setSearchParams(next, { replace: true });
  };
  const applyQuery = (nextQuery) => {
    setQuery(nextQuery);
    commitQueryToUrl(nextQuery);
  };
  const reset = () => {
    setQuery("");
    setTech([]);
    setLevel([]);
    setWorkModel([]);
    commitQueryToUrl("");
  };
  const activeFilterCount = tech.length + level.length + workModel.length;
  const displayedCount = resultCount ?? jobs.length;
  const hasMore = catalogStatus === "ready" && resultCount != null && jobs.length < resultCount;
  const catalogAnnouncement =
    catalogStatus === "loading" && jobs.length === 0
      ? "Carregando vagas"
      : catalogStatus === "error" && jobs.length === 0
        ? "Catálogo indisponível"
        : catalogStatus === "ready" && jobs.length === 0
          ? "Nenhuma vaga encontrada"
          : "";

  const standardHero = <section className="hero"><div className="shell hero-content"><div className="eyebrow"><Sparkles size={15}/> Vagas curadas pela comunidade</div><h1>Encontre o próximo passo<br/>da sua <em>carreira em tech.</em></h1><p>Oportunidades em empresas incríveis, selecionadas para quem quer construir o futuro.</p><form className="searchbox" role="search" aria-label="Buscar vagas no catálogo" onSubmit={(event) => { event.preventDefault(); commitQueryToUrl(query); }}><Search size={21} aria-hidden="true"/><input id="catalog-query" name="q" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cargo, tecnologia ou empresa" aria-label="Cargo, tecnologia ou empresa"/><button className="primary" type="submit">Buscar vagas <ArrowUpRight size={17}/></button></form><div className="popular">Populares: <button type="button" onClick={() => applyQuery("React")}>React</button><button type="button" onClick={() => applyQuery("Node")}>Node.js</button><button type="button" onClick={() => applyQuery("Python")}>Python</button><button type="button" onClick={() => applyQuery("Designer")}>Product Design</button></div>    </div></section>;

  return <main id="conteudo" tabIndex={-1}>
    {standardHero}
    <div className="home-divider" aria-hidden="true">
      <svg className="home-divider__curve" viewBox="0 0 1440 120" preserveAspectRatio="none" focusable="false">
        <path fill="var(--color-surface)" stroke="none" d="M-8 52 C 180 118 380 14 560 64 C 740 112 920 8 1100 58 C 1240 96 1360 22 1448 48 L 1448 128 L -8 128 Z" />
      </svg>
      <img className="home-divider__avatar" src="/avatar-gdgjobs.png" alt="" width={1169} height={987} loading="eager" decoding="async" />
    </div>
    <section className="shell jobs-layout">
      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} resultCount={displayedCount} titleId="catalog-filters-title">
        <div className="filter-head">
          <h2 id="catalog-filters-title"><Filter size={18}/> Filtros</h2>
          <button type="button" onClick={reset}>Limpar</button>
        </div>
        <div className="filters__body">
          <FilterGroup name="catalog-tech" label="Tecnologias" values={CATALOG_TECHNOLOGIES} active={tech} toggle={x => toggle(x, tech, setTech)} />
          <FilterGroup name="catalog-level" label="Nível de experiência" values={CATALOG_LEVELS} active={level} toggle={x => toggle(x, level, setLevel)} />
          <FilterGroup name="catalog-work-model" label="Modelo de trabalho" values={CATALOG_WORK_MODELS} active={workModel} toggle={x => toggle(x, workModel, setWorkModel)} />
        </div>
      </FilterSheet>
      <div className="job-content">
        <div className="result-head">
          <div>
            <h2>Vagas em destaque</h2>
            <p>{displayedCount} oportunidades encontradas</p>
          </div>
          <button className="filter-mobile" type="button" onClick={() => setFilterOpen(true)}><Filter size={16}/> Filtros {activeFilterCount > 0 && <b>{activeFilterCount}</b>}</button>
          <SortMenu value={sortOrder} onChange={setSortOrder} />
        </div>
        <div className="cards">
          {catalogAnnouncement ? <p className="sr-only" role="status">{catalogAnnouncement}</p> : null}
          {catalogStatus === "loading" && jobs.length === 0 ? [1, 2, 3, 4].map((slot) => <article key={slot} className="job-card job-card--skeleton job-card--skeleton-static" aria-hidden="true" />) : null}
          {jobs.map(job => <JobCard key={job.id} job={job} />)}
          {catalogStatus === "error" && jobs.length === 0 && <div className="empty"><Search size={32} aria-hidden="true"/><h3>Catálogo indisponível</h3><p>Configure o projeto Supabase de teste em .env.local para listar vagas aprovadas.</p></div>}
          {catalogStatus === "ready" && jobs.length === 0 && <div className="empty"><Search size={32} aria-hidden="true"/><h3>Nenhuma vaga encontrada</h3><p>Tente remover alguns filtros ou buscar outro termo.</p><button className="outline" type="button" onClick={reset}>Limpar filtros</button></div>}
        </div>
        {hasMore ? (
          <div className="catalog-more">
            <button type="button" className="outline" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Carregando…" : "Carregar mais"}
            </button>
          </div>
        ) : null}
      </div>
    </section>
    {!logged && (
      <section className="cta"><div className="shell cta-inner"><div><div className="eyebrow light"><Users size={15}/> Seu perfil abre caminhos</div><h2>A vaga certa começa<br/>com um perfil que representa você.</h2><p>Crie seu perfil e apresente suas habilidades para oportunidades mais alinhadas.</p></div><Link to="/login" className="white-button">Criar perfil gratuito <ArrowUpRight size={17}/></Link></div></section>
    )}
  </main>;
}

function SortMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const label = value === SORT_OLDEST ? "Mais antigas" : "Mais recentes";

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (next) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div className="sort-wrap" ref={rootRef}>
      <button
        type="button"
        className="sort"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="catalog-sort-menu"
        onClick={() => setOpen((current) => !current)}
      >
        {label} <ChevronDown size={16} />
      </button>
      {open && (
        <ul id="catalog-sort-menu" className="sort-menu" role="listbox" aria-label="Ordenar vagas">
          <li>
            <button type="button" role="option" aria-selected={value === SORT_RECENT} onClick={() => choose(SORT_RECENT)}>Mais recentes</button>
          </li>
          <li>
            <button type="button" role="option" aria-selected={value === SORT_OLDEST} onClick={() => choose(SORT_OLDEST)}>Mais antigas</button>
          </li>
        </ul>
      )}
    </div>
  );
}

function FilterGroup({ name, label, values, active, toggle }) {
  return (
    <div className="filter-group">
      <h3>{label}</h3>
      {values.map((value) => {
        const id = formOptionId(name, value);
        return (
          <label key={value} className="checkline">
            <input type="checkbox" id={id} name={name} value={value} checked={active.includes(value)} onChange={() => toggle(value)} />
            <span className="check"><Check size={13} /></span>
            {value}
          </label>
        );
      })}
    </div>
  );
}

function JobCard({ job }) {
  return (
    <Link className="job-card" to={`/jobs/${job.id}`} state={{ from: "/vagas" }}>
      <div className="company-logo" style={{ background: job.color }}>{job.logo}</div>
      <div className="job-main">
        <div className="job-title">
          <h3>{job.title}</h3>
          {job.featured && <span className="featured"><Sparkles size={13}/> Destaque</span>}
        </div>
        <p className="company-name">{job.company} <BadgeCheck size={15}/></p>
        <div className="meta">
          <span><MapPin size={15}/>{job.place}</span>
          <span><BriefcaseBusiness size={15}/>{job.type}</span>
          <span><CircleDollarSign size={15}/>{job.salary}</span>
        </div>
        <div className="tags">{(job.stack ?? []).map((t) => <span key={t}>{t}</span>)}</div>
      </div>
      <div className="job-side">
        <span>{job.posted}</span>
        <span className="round-arrow" aria-hidden="true"><ArrowUpRight size={18}/></span>
      </div>
    </Link>
  );
}
