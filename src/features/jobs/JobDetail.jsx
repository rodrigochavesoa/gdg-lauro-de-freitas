import React from "react";
import {
  ArrowLeft, BadgeCheck, BriefcaseBusiness, Check,
  Clock3, GraduationCap, MapPin, Send, Sparkles
} from "lucide-react";

export function JobDetail({ job, goBack, logged, setLogged, applicationSent, setApplicationSent }) {
  const apply = () => { if (!logged) { setLogged(true); } setApplicationSent(true); };
  return <main className="detail-page"><div className="shell"><button className="back" onClick={goBack}><ArrowLeft size={17}/> Voltar para vagas</button><div className="detail-grid"><article className="detail-main"><div className="detail-top"><div className="company-logo large" style={{ background: job.color }}>{job.logo}</div><div><div className="detail-title"><h1>{job.title}</h1><span className="featured"><Sparkles size={13}/> Destaque</span></div><p className="company-name">{job.company} <BadgeCheck size={15}/></p></div></div><div className="detail-meta"><span><MapPin size={17}/>{job.place}</span><span><BriefcaseBusiness size={17}/>{job.type}</span><span><GraduationCap size={17}/>{job.level}</span></div><hr/><ContentBlock title="Sobre a oportunidade"><p>{job.description}</p><p>Você fará parte de um time colaborativo, com autonomia para propor soluções e espaço para aprender continuamente.</p></ContentBlock><ContentBlock title="O que você vai fazer"><ul>{(job.responsibilities ?? []).map(x => <li key={x}><Check size={17}/>{x}</li>)}</ul></ContentBlock><ContentBlock title="Tecnologias"><div className="tags big">{(job.stack ?? []).map(t => <span key={t}>{t}</span>)}</div></ContentBlock><ContentBlock title={`Sobre a ${job.company}`}><p>{job.about}</p></ContentBlock></article><aside className="apply-card"><div><span className="muted">Faixa salarial</span><strong>{job.salary}</strong></div><div><span className="muted">Publicada</span><strong><Clock3 size={15}/>{job.posted}</strong></div>{applicationSent ? <div className="applied"><Check size={20}/><div><strong>Candidatura enviada!</strong><p>Boa sorte — a empresa receberá seu perfil.</p></div></div> : <button className="primary apply" onClick={apply}><Send size={17}/> Candidatar-se com 1 clique</button>}<p className="tiny">Ao se candidatar, seu perfil será compartilhado com a empresa.</p></aside></div></div></main>;
}

function ContentBlock({ title, children }) {
  return <section className="content-block"><h2>{title}</h2>{children}</section>;
}
