import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight, BadgeCheck, BriefcaseBusiness,
  Check, ChevronDown, CircleDollarSign, Filter,
  MapPin, Search, Sparkles, Users, X
} from "lucide-react";
import { filterJobs, toggleFilterValue } from "../../lib/filter-jobs.js";
import { loadApprovedJobs } from "./jobs-api.js";

const levels = ["Estágio", "Júnior", "Pleno", "Sênior"];
const technologies = ["React", "Node.js", "TypeScript", "Python", "UX/UI", "Dados"];

export function Home({ onOpenJob }) {
  const [jobs, setJobs] = useState([]);
  const [catalogStatus, setCatalogStatus] = useState("loading");
  const [query, setQuery] = useState("");
  const [tech, setTech] = useState([]);
  const [level, setLevel] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);

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

  const toggle = (item, values, setter) => setter(toggleFilterValue(item, values));
  const reset = () => { setQuery(""); setTech([]); setLevel([]); };
  const openJob = (job) => { onOpenJob(job); };

  return <main>
    <section className="hero"><div className="shell hero-content"><div className="eyebrow"><Sparkles size={15}/> Vagas curadas pela comunidade</div><h1>Encontre o próximo passo<br/>da sua <em>carreira em tech.</em></h1><p>Oportunidades em empresas incríveis, selecionadas para quem quer construir o futuro.</p><div className="searchbox"><Search size={21}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cargo, tecnologia ou empresa"/><button className="primary" onClick={() => {}}>Buscar vagas <ArrowUpRight size={17}/></button></div><div className="popular">Populares: <button onClick={() => setQuery("React")}>React</button><button onClick={() => setQuery("Node")}>Node.js</button><button onClick={() => setQuery("Python")}>Python</button><button onClick={() => setQuery("Designer")}>Product Design</button></div></div></section>
    <section className="shell jobs-layout"><aside className={`filters ${filterOpen ? "open" : ""}`}><div className="filter-head"><h2><Filter size={18}/> Filtros</h2><button onClick={reset}>Limpar</button><button className="close-filter" onClick={() => setFilterOpen(false)}><X size={18}/></button></div><FilterGroup label="Tecnologias" values={technologies} active={tech} toggle={x => toggle(x, tech, setTech)} /><FilterGroup label="Nível de experiência" values={levels} active={level} toggle={x => toggle(x, level, setLevel)} /><FilterGroup label="Modelo de trabalho" values={["Remoto", "Híbrido", "Presencial"]} active={[]} toggle={() => {}} /></aside>
      <div className="job-content"><div className="result-head"><div><h2>Vagas em destaque</h2><p>{filtered.length} oportunidades encontradas</p></div><button className="filter-mobile" onClick={() => setFilterOpen(true)}><Filter size={16}/> Filtros {(tech.length + level.length) > 0 && <b>{tech.length + level.length}</b>}</button><button className="sort">Mais recentes <ChevronDown size={16}/></button></div><div className="cards">{filtered.map(job => <JobCard key={job.id} job={job} openJob={() => openJob(job)} />)}{catalogStatus === "loading" && filtered.length === 0 && <div className="empty"><Search size={32}/><h3>Carregando vagas</h3><p>Buscando oportunidades aprovadas pela curadoria.</p></div>}{catalogStatus === "error" && filtered.length === 0 && <div className="empty"><Search size={32}/><h3>Catálogo indisponível</h3><p>Configure o projeto Supabase de teste em .env.local para listar vagas aprovadas.</p></div>}{catalogStatus === "ready" && filtered.length === 0 && <div className="empty"><Search size={32}/><h3>Nenhuma vaga encontrada</h3><p>Tente remover alguns filtros ou buscar outro termo.</p><button className="outline" onClick={reset}>Limpar filtros</button></div>}</div></div>
    </section>
    <section className="cta"><div className="shell cta-inner"><div><div className="eyebrow light"><Users size={15}/> Comunidade GDG</div><h2>Seu próximo desafio pode<br/>estar a um clique.</h2><p>Crie seu perfil e receba vagas que combinam com você.</p></div><button className="white-button">Criar perfil gratuito <ArrowUpRight size={17}/></button></div></section>
  </main>;
}

function FilterGroup({ label, values, active, toggle }) { return <div className="filter-group"><h3>{label}</h3>{values.map(value => <label key={value} className="checkline"><input type="checkbox" checked={active.includes(value)} onChange={() => toggle(value)} /><span className="check"><Check size={13}/></span>{value}</label>)}</div> }

function JobCard({ job, openJob }) { return <article className="job-card" onClick={openJob}><div className="company-logo" style={{ background: job.color }}>{job.logo}</div><div className="job-main"><div className="job-title"><h3>{job.title}</h3>{job.featured && <span className="featured"><Sparkles size={13}/> Destaque</span>}</div><p className="company-name">{job.company} <BadgeCheck size={15}/></p><div className="meta"><span><MapPin size={15}/>{job.place}</span><span><BriefcaseBusiness size={15}/>{job.type}</span><span><CircleDollarSign size={15}/>{job.salary}</span></div><div className="tags">{(job.stack ?? []).map(t => <span key={t}>{t}</span>)}</div></div><div className="job-side"><span>{job.posted}</span><button className="round-arrow" aria-label={`Ver vaga ${job.title}`}><ArrowUpRight size={18}/></button></div></article> }
