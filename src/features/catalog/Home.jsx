import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight, BadgeCheck, BriefcaseBusiness,
  Check, ChevronDown, CircleDollarSign, Filter,
  MapPin, Search, Sparkles, Users, X
} from "lucide-react";
import { filterJobs, SORT_OLDEST, SORT_RECENT, sortJobs, toggleFilterValue } from "../../lib/filter-jobs.js";
import { loadApprovedJobs, peekApprovedJobsCache } from "./jobs-api.js";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

const levels = ["Estágio", "Júnior", "Pleno", "Sênior"];
const technologies = ["React", "Node.js", "TypeScript", "Python", "UX/UI", "Dados"];

export function Home({ logged = false }) {
  const [jobs, setJobs] = useState(() => peekApprovedJobsCache() ?? []);
  const [catalogStatus, setCatalogStatus] = useState(() => (peekApprovedJobsCache() ? "ready" : "loading"));
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("query") ?? "");
  const [tech, setTech] = useState([]);
  const [level, setLevel] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState(SORT_RECENT);

  useEffect(() => {
    let cancelled = false;
    loadApprovedJobs()
      .then((rows) => {
        if (cancelled) return;
        setJobs(rows);
        setCatalogStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setJobs([]);
        setCatalogStatus("error");
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(
    () => filterJobs(jobs, { query, tech, level }),
    [jobs, query, tech, level],
  );
  const visibleJobs = useMemo(
    () => sortJobs(filtered, sortOrder),
    [filtered, sortOrder],
  );

  const toggle = (item, values, setter) => setter(toggleFilterValue(item, values));
  const reset = () => { setQuery(""); setTech([]); setLevel([]); };

  const standardHero = <section className="hero"><div className="shell hero-content"><div className="eyebrow"><Sparkles size={15}/> Vagas curadas pela comunidade</div><h1>Encontre o próximo passo<br/>da sua <em>carreira em tech.</em></h1><p>Oportunidades em empresas incríveis, selecionadas para quem quer construir o futuro.</p><div className="searchbox"><Search size={21}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cargo, tecnologia ou empresa"/><button className="primary" onClick={() => {}}>Buscar vagas <ArrowUpRight size={17}/></button></div><div className="popular">Populares: <button onClick={() => setQuery("React")}>React</button><button onClick={() => setQuery("Node")}>Node.js</button><button onClick={() => setQuery("Python")}>Python</button><button onClick={() => setQuery("Designer")}>Product Design</button></div>    </div></section>;

  return <main>
    {standardHero}
    <div className="home-divider" aria-hidden="true">
      <svg className="home-divider__curve" viewBox="0 0 1440 120" preserveAspectRatio="none" focusable="false">
        <path fill="var(--color-surface)" stroke="none" d="M-8 52 C 180 118 380 14 560 64 C 740 112 920 8 1100 58 C 1240 96 1360 22 1448 48 L 1448 128 L -8 128 Z" />
      </svg>
      <img className="home-divider__avatar" src="/avatar-gdgjobs.png" alt="" loading="lazy" decoding="async" />
    </div>
    <section className="shell jobs-layout"><aside className={`filters ${filterOpen ? "open" : ""}`}><div className="filter-head"><h2><Filter size={18}/> Filtros</h2><button onClick={reset}>Limpar</button><button className="close-filter" onClick={() => setFilterOpen(false)}><X size={18}/></button></div><FilterGroup label="Tecnologias" values={technologies} active={tech} toggle={x => toggle(x, tech, setTech)} /><FilterGroup label="Nível de experiência" values={levels} active={level} toggle={x => toggle(x, level, setLevel)} /><FilterGroup label="Modelo de trabalho" values={["Remoto", "Híbrido", "Presencial"]} active={[]} toggle={() => {}} /></aside>
      <div className="job-content"><div className="result-head"><div><h2>Vagas em destaque</h2><p>{visibleJobs.length} oportunidades encontradas</p></div><button className="filter-mobile" onClick={() => setFilterOpen(true)}><Filter size={16}/> Filtros {(tech.length + level.length) > 0 && <b>{tech.length + level.length}</b>}</button><SortMenu value={sortOrder} onChange={setSortOrder} /></div><div className="cards">{catalogStatus === "loading" && visibleJobs.length === 0 ? [1, 2, 3, 4].map((slot) => <article key={slot} className="job-card job-card--skeleton job-card--skeleton-static" aria-hidden="true" />) : null}{visibleJobs.map(job => <JobCard key={job.id} job={job} />)}{catalogStatus === "error" && visibleJobs.length === 0 && <div className="empty"><Search size={32}/><h3>Catálogo indisponível</h3><p>Configure o projeto Supabase de teste em .env.local para listar vagas aprovadas.</p></div>}{catalogStatus === "ready" && visibleJobs.length === 0 && <div className="empty"><Search size={32}/><h3>Nenhuma vaga encontrada</h3><p>Tente remover alguns filtros ou buscar outro termo.</p><button className="outline" onClick={reset}>Limpar filtros</button></div>}</div></div>
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

function FilterGroup({ label, values, active, toggle }) { return <div className="filter-group"><h3>{label}</h3>{values.map(value => <label key={value} className="checkline"><input type="checkbox" checked={active.includes(value)} onChange={() => toggle(value)} /><span className="check"><Check size={13}/></span>{value}</label>)}</div> }

function JobCard({ job }) {
  const navigate = useNavigate();
  const openJob = () => navigate(`/jobs/${job.id}`);
  return <article className="job-card" onClick={openJob}><div className="company-logo" style={{ background: job.color }}>{job.logo}</div><div className="job-main"><div className="job-title"><h3>{job.title}</h3>{job.featured && <span className="featured"><Sparkles size={13}/> Destaque</span>}</div><p className="company-name">{job.company} <BadgeCheck size={15}/></p><div className="meta"><span><MapPin size={15}/>{job.place}</span><span><BriefcaseBusiness size={15}/>{job.type}</span><span><CircleDollarSign size={15}/>{job.salary}</span></div><div className="tags">{(job.stack ?? []).map(t => <span key={t}>{t}</span>)}</div></div><div className="job-side"><span>{job.posted}</span><button className="round-arrow" aria-label={`Ver vaga ${job.title}`} onClick={(event) => { event.stopPropagation(); openJob(); }}><ArrowUpRight size={18}/></button></div></article>;
}
