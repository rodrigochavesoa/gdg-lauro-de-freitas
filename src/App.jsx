import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowUpRight, BadgeCheck, BriefcaseBusiness, Building2,
  Check, ChevronDown, CircleDollarSign, Clock3, Filter,
  GraduationCap, LayoutDashboard, LogOut, MapPin, Menu, Plus,
  Search, Send, Sparkles, Users, X
} from "lucide-react";
import { filterJobs, toggleFilterValue } from "./lib/filter-jobs.js";
import { loadApprovedJobs } from "./lib/jobs-api.js";

const levels = ["Estágio", "Júnior", "Pleno", "Sênior"];
const technologies = ["React", "Node.js", "TypeScript", "Python", "UX/UI", "Dados"];

export function App() {
  const [page, setPage] = useState("home");
  const [jobs, setJobs] = useState([]);
  const [catalogStatus, setCatalogStatus] = useState("loading");
  const [selectedJob, setSelectedJob] = useState(null);
  const [query, setQuery] = useState("");
  const [tech, setTech] = useState([]);
  const [level, setLevel] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [logged, setLogged] = useState(false);
  const [applicationSent, setApplicationSent] = useState(false);

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

  const openJob = job => { setSelectedJob(job); setApplicationSent(false); setPage("detail"); window.scrollTo(0, 0); };
  const toggle = (item, values, setter) => setter(toggleFilterValue(item, values));
  const reset = () => { setQuery(""); setTech([]); setLevel([]); };

  return <>
    <Header page={page} setPage={setPage} logged={logged} setLogged={setLogged} />
    {page === "home" && <Home {...{ query, setQuery, tech, setTech, level, setLevel, filterOpen, setFilterOpen, filtered, catalogStatus, toggle, reset, openJob }} />}
    {page === "detail" && selectedJob && <JobDetail job={selectedJob} goBack={() => setPage("home")} logged={logged} setLogged={setLogged} applicationSent={applicationSent} setApplicationSent={setApplicationSent} />}
    {page === "admin" && <Admin />}
    {page === "login" && <Login onLogin={() => { setLogged(true); setPage("home"); }} />}
    <Footer />
  </>;
}

function Header({ page, setPage, logged, setLogged }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const closeMobileMenu = () => { menuButtonRef.current?.focus(); setMobileMenuOpen(false); };
  const navigateFromMobile = target => { setPage(target); closeMobileMenu(); };
  return <header className="topbar"><div className="shell nav">
    <button className="brand" onClick={() => setPage("home")} aria-label="Ir para a página inicial"><span className="brand-mark"><img src="/favicon.svg" alt="" /></span><span>GDG<span>Jobs</span></span></button>
    <nav><button className={page === "home" ? "active" : ""} onClick={() => setPage("home")}>Vagas</button><button onClick={() => setPage("admin")}>Para empresas</button><button onClick={() => setPage("admin")}>Comunidade</button></nav>
    <div className="nav-actions">{logged ? <><button className="icon-button"><span className="avatar">AM</span></button><button className="ghost hide-mobile" onClick={() => setLogged(false)}><LogOut size={16}/> Sair</button></> : <><button className="ghost hide-mobile" onClick={() => setPage("login")}>Entrar</button><button className="primary small" onClick={() => setPage("login")}>Criar conta</button></>}<button ref={menuButtonRef} className="menu" onClick={() => setMobileMenuOpen(open => !open)} aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation">{mobileMenuOpen ? <X size={20}/> : <Menu size={20}/>}</button></div>
  </div>{mobileMenuOpen && <div id="mobile-navigation" className="mobile-nav open"><button className={page === "home" ? "active" : ""} onClick={() => navigateFromMobile("home")}>Vagas</button><button onClick={() => navigateFromMobile("admin")}>Para empresas</button><button onClick={() => navigateFromMobile("admin")}>Comunidade</button>{logged ? <button onClick={() => { setLogged(false); closeMobileMenu(); }}><LogOut size={17}/> Sair</button> : <><button onClick={() => navigateFromMobile("login")}>Entrar</button><button className="primary" onClick={() => navigateFromMobile("login")}>Criar conta</button></>}</div>}</header>
}

function Home({ query, setQuery, tech, setTech, level, setLevel, filterOpen, setFilterOpen, filtered, catalogStatus, toggle, reset, openJob }) {
  return <main>
    <section className="hero"><div className="shell hero-content"><div className="eyebrow"><Sparkles size={15}/> Vagas curadas pela comunidade</div><h1>Encontre o próximo passo<br/>da sua <em>carreira em tech.</em></h1><p>Oportunidades em empresas incríveis, selecionadas para quem quer construir o futuro.</p><div className="searchbox"><Search size={21}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cargo, tecnologia ou empresa"/><button className="primary" onClick={() => {}}>Buscar vagas <ArrowUpRight size={17}/></button></div><div className="popular">Populares: <button onClick={() => setQuery("React")}>React</button><button onClick={() => setQuery("Node")}>Node.js</button><button onClick={() => setQuery("Python")}>Python</button><button onClick={() => setQuery("Designer")}>Product Design</button></div></div></section>
    <section className="shell jobs-layout"><aside className={`filters ${filterOpen ? "open" : ""}`}><div className="filter-head"><h2><Filter size={18}/> Filtros</h2><button onClick={reset}>Limpar</button><button className="close-filter" onClick={() => setFilterOpen(false)}><X size={18}/></button></div><FilterGroup label="Tecnologias" values={technologies} active={tech} toggle={x => toggle(x, tech, setTech)} /><FilterGroup label="Nível de experiência" values={levels} active={level} toggle={x => toggle(x, level, setLevel)} /><FilterGroup label="Modelo de trabalho" values={["Remoto", "Híbrido", "Presencial"]} active={[]} toggle={() => {}} /></aside>
      <div className="job-content"><div className="result-head"><div><h2>Vagas em destaque</h2><p>{filtered.length} oportunidades encontradas</p></div><button className="filter-mobile" onClick={() => setFilterOpen(true)}><Filter size={16}/> Filtros {(tech.length + level.length) > 0 && <b>{tech.length + level.length}</b>}</button><button className="sort">Mais recentes <ChevronDown size={16}/></button></div><div className="cards">{filtered.map(job => <JobCard key={job.id} job={job} openJob={() => openJob(job)} />)}{catalogStatus === "loading" && filtered.length === 0 && <div className="empty"><Search size={32}/><h3>Carregando vagas</h3><p>Buscando oportunidades aprovadas pela curadoria.</p></div>}{catalogStatus === "error" && filtered.length === 0 && <div className="empty"><Search size={32}/><h3>Catálogo indisponível</h3><p>Configure o projeto Supabase de teste em .env.local para listar vagas aprovadas.</p></div>}{catalogStatus === "ready" && filtered.length === 0 && <div className="empty"><Search size={32}/><h3>Nenhuma vaga encontrada</h3><p>Tente remover alguns filtros ou buscar outro termo.</p><button className="outline" onClick={reset}>Limpar filtros</button></div>}</div></div>
    </section>
    <section className="cta"><div className="shell cta-inner"><div><div className="eyebrow light"><Users size={15}/> Comunidade GDG</div><h2>Seu próximo desafio pode<br/>estar a um clique.</h2><p>Crie seu perfil e receba vagas que combinam com você.</p></div><button className="white-button">Criar perfil gratuito <ArrowUpRight size={17}/></button></div></section>
  </main>
}

function FilterGroup({ label, values, active, toggle }) { return <div className="filter-group"><h3>{label}</h3>{values.map(value => <label key={value} className="checkline"><input type="checkbox" checked={active.includes(value)} onChange={() => toggle(value)} /><span className="check"><Check size={13}/></span>{value}</label>)}</div> }

function JobCard({ job, openJob }) { return <article className="job-card" onClick={openJob}><div className="company-logo" style={{ background: job.color }}>{job.logo}</div><div className="job-main"><div className="job-title"><h3>{job.title}</h3>{job.featured && <span className="featured"><Sparkles size={13}/> Destaque</span>}</div><p className="company-name">{job.company} <BadgeCheck size={15}/></p><div className="meta"><span><MapPin size={15}/>{job.place}</span><span><BriefcaseBusiness size={15}/>{job.type}</span><span><CircleDollarSign size={15}/>{job.salary}</span></div><div className="tags">{(job.stack ?? []).map(t => <span key={t}>{t}</span>)}</div></div><div className="job-side"><span>{job.posted}</span><button className="round-arrow" aria-label={`Ver vaga ${job.title}`}><ArrowUpRight size={18}/></button></div></article> }

function JobDetail({ job, goBack, logged, setLogged, applicationSent, setApplicationSent }) { const apply = () => { if (!logged) { setLogged(true); } setApplicationSent(true); }; return <main className="detail-page"><div className="shell"><button className="back" onClick={goBack}><ArrowLeft size={17}/> Voltar para vagas</button><div className="detail-grid"><article className="detail-main"><div className="detail-top"><div className="company-logo large" style={{ background: job.color }}>{job.logo}</div><div><div className="detail-title"><h1>{job.title}</h1><span className="featured"><Sparkles size={13}/> Destaque</span></div><p className="company-name">{job.company} <BadgeCheck size={15}/></p></div></div><div className="detail-meta"><span><MapPin size={17}/>{job.place}</span><span><BriefcaseBusiness size={17}/>{job.type}</span><span><GraduationCap size={17}/>{job.level}</span></div><hr/><ContentBlock title="Sobre a oportunidade"><p>{job.description}</p><p>Você fará parte de um time colaborativo, com autonomia para propor soluções e espaço para aprender continuamente.</p></ContentBlock><ContentBlock title="O que você vai fazer"><ul>{(job.responsibilities ?? []).map(x => <li key={x}><Check size={17}/>{x}</li>)}</ul></ContentBlock><ContentBlock title="Tecnologias"><div className="tags big">{(job.stack ?? []).map(t => <span key={t}>{t}</span>)}</div></ContentBlock><ContentBlock title={`Sobre a ${job.company}`}><p>{job.about}</p></ContentBlock></article><aside className="apply-card"><div><span className="muted">Faixa salarial</span><strong>{job.salary}</strong></div><div><span className="muted">Publicada</span><strong><Clock3 size={15}/>{job.posted}</strong></div>{applicationSent ? <div className="applied"><Check size={20}/><div><strong>Candidatura enviada!</strong><p>Boa sorte — a empresa receberá seu perfil.</p></div></div> : <button className="primary apply" onClick={apply}><Send size={17}/> Candidatar-se com 1 clique</button>}<p className="tiny">Ao se candidatar, seu perfil será compartilhado com a empresa.</p></aside></div></div></main> }
function ContentBlock({ title, children }) { return <section className="content-block"><h2>{title}</h2>{children}</section> }

function Login({ onLogin }) { return <main className="login-page"><section className="login-panel"><button className="login-dynamic-brand" onClick={() => location.reload()} aria-label="Atualizar página de login"><img src="/gdg-jobs-dynamic-brand.svg" alt="GDGJobs — vagas em tempo real" /></button><img className="login-illustration" src="/login-gdg-illustration.svg" alt="" aria-hidden="true" /><div className="login-copy"><div className="eyebrow"><Sparkles size={15}/> Bem-vindo de volta</div><h1>Grandes oportunidades começam aqui.</h1><p>Acesse sua conta para salvar vagas e se candidatar com um clique.</p></div><div className="quote">“Uma comunidade feita por pessoas que acreditam no poder da tecnologia.”<span>— GDG Lauro de Freitas</span></div></section><section className="login-form"><div><h2>Entre na sua conta</h2><p>Use sua conta Google para continuar.</p></div><button className="google" onClick={onLogin}><img className="google-icon" src="/google-icon.svg" alt="" />Continuar com Google</button><div className="divider"><span/>ou<span/></div><label>E-mail<input type="email" placeholder="voce@email.com"/></label><button className="primary full" onClick={onLogin}>Continuar</button><p className="terms">Ao continuar, você concorda com nossos Termos de uso e Política de privacidade.</p></section></main> }

function Admin() { const [saved, setSaved] = useState(false); return <main className="admin-page"><div className="shell admin-shell"><aside className="admin-side"><button className="brand"><span className="brand-mark"><img src="/favicon.svg" alt="" /></span><span>GDG<span>Jobs</span></span></button><div className="admin-user"><span className="avatar">AM</span><div><strong>Admin GDG</strong><small>administrador</small></div></div><nav><button className="active"><LayoutDashboard size={18}/> Visão geral</button><button><BriefcaseBusiness size={18}/> Vagas</button><button><Building2 size={18}/> Empresas</button></nav></aside><section className="admin-content"><div className="admin-title"><div><span className="eyebrow">Área administrativa</span><h1>Publicar nova vaga</h1><p>As vagas entram como pendentes e passam pela curadoria da comunidade.</p></div><button className="outline"><BriefcaseBusiness size={16}/> Ver vagas</button></div><form className="job-form" onSubmit={e => { e.preventDefault(); setSaved(true); }}><div className="form-section"><h2>Informações da vaga</h2><div className="form-grid"><label className="wide">Título da vaga<input required placeholder="Ex.: Pessoa Desenvolvedora Front-end"/></label><label>Empresa<select><option>Selecione uma empresa</option><option>Zup Innovation</option><option>Cora</option></select></label><label>Nível<select><option>Selecione o nível</option><option>Júnior</option><option>Pleno</option><option>Sênior</option></select></label><label className="wide">Descrição<textarea required placeholder="Descreva a oportunidade, responsabilidades e requisitos..." rows="6"/></label></div></div><div className="form-section"><h2>Detalhes</h2><div className="form-grid"><label>Tecnologias<input placeholder="React, TypeScript, Next.js"/></label><label>Localidade<input placeholder="Ex.: Remoto · Brasil"/></label><label>Modelo<select><option>Remoto</option><option>Híbrido</option><option>Presencial</option></select></label><label>Tipo de contrato<select><option>CLT</option><option>PJ</option><option>Estágio</option></select></label></div></div>{saved && <div className="success"><Check size={18}/> Vaga cadastrada como pendente de curadoria.</div>}<div className="form-actions"><button type="button" className="ghost">Salvar rascunho</button><button className="primary" type="submit"><Plus size={17}/> Cadastrar para curadoria</button></div></form></section></div></main> }
function Footer() { return <footer><div className="shell footer-inner"><span className="brand"><span className="brand-mark"><img src="/favicon.svg" alt="" /></span>GDG<span>Jobs</span></span><span>Feito com a comunidade GDG · 2026</span></div></footer> }
