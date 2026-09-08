import React from "react";
import {
  ArrowLeft, BadgeCheck, BriefcaseBusiness, Check,
  Clock3, GraduationCap, MapPin, Send, Sparkles
} from "lucide-react";
import { APPLICATION_STATUS_COPY, canWithdrawStatus } from "./apply-api.js";

export function JobDetailSkeleton({ goBack }) {
  return (
    <main className="detail-page" aria-busy="true" aria-live="polite">
      <div className="shell">
        <button className="back" type="button" onClick={goBack}><ArrowLeft size={17}/> Voltar para vagas</button>
        <div className="detail-grid">
          <article className="detail-main" aria-hidden="true">
            <div className="detail-top">
              <div className="company-logo large job-card--skeleton" />
              <div className="detail-skeleton-copy">
                <span className="detail-skeleton-line detail-skeleton-line--title job-card--skeleton" />
                <span className="detail-skeleton-line detail-skeleton-line--meta job-card--skeleton" />
              </div>
            </div>
            <div className="detail-meta">
              <span className="detail-skeleton-line detail-skeleton-line--chip job-card--skeleton" />
              <span className="detail-skeleton-line detail-skeleton-line--chip job-card--skeleton" />
              <span className="detail-skeleton-line detail-skeleton-line--chip job-card--skeleton" />
            </div>
            <hr/>
            <section className="content-block">
              <span className="detail-skeleton-line detail-skeleton-line--heading job-card--skeleton" />
              <span className="detail-skeleton-line job-card--skeleton" />
              <span className="detail-skeleton-line job-card--skeleton" />
              <span className="detail-skeleton-line detail-skeleton-line--short job-card--skeleton" />
            </section>
            <section className="content-block">
              <span className="detail-skeleton-line detail-skeleton-line--heading job-card--skeleton" />
              <span className="detail-skeleton-line job-card--skeleton" />
              <span className="detail-skeleton-line detail-skeleton-line--short job-card--skeleton" />
            </section>
          </article>
          <aside className="apply-card" aria-hidden="true">
            <span className="detail-skeleton-line job-card--skeleton" />
            <span className="detail-skeleton-line job-card--skeleton" />
            <span className="detail-skeleton-line detail-skeleton-line--cta job-card--skeleton" />
          </aside>
        </div>
        <p className="tiny detail-skeleton-sr">Carregando detalhes da vaga</p>
      </div>
    </main>
  );
}

function ContentSkeleton() {
  return (
    <div className="detail-skeleton-block" aria-hidden="true">
      <span className="detail-skeleton-line job-card--skeleton" />
      <span className="detail-skeleton-line job-card--skeleton" />
      <span className="detail-skeleton-line detail-skeleton-line--short job-card--skeleton" />
    </div>
  );
}

export function JobDetail({
  job,
  isPartial = false,
  goBack,
  logged,
  onNeedLogin,
  onNeedOnboarding,
  needsOnboarding,
  applicationStatus,
  applicationLoading = false,
  applicationCheckFailed = false,
  onApply,
  onWithdraw,
  applyBusy,
  applyError,
}) {
  const apply = () => {
    if (!logged) {
      onNeedLogin?.();
      return;
    }
    if (needsOnboarding) {
      onNeedOnboarding?.();
      return;
    }
    onApply?.();
  };

  const copy = APPLICATION_STATUS_COPY[applicationStatus];
  const showChecking = Boolean(logged && applicationLoading);
  const showApplied = Boolean(copy) && !showChecking;
  const showApply = !showChecking && !showApplied && !applicationCheckFailed;
  const showWithdraw = !showChecking && !applicationCheckFailed && canWithdrawStatus(applicationStatus);

  return (
    <main className="detail-page" aria-busy={isPartial || undefined}>
      <div className="shell">
        <button className="back" onClick={goBack}><ArrowLeft size={17}/> Voltar para vagas</button>
        <div className="detail-grid">
          <article className="detail-main">
            <div className="detail-top">
              <div className="company-logo large" style={{ background: job.color }}>{job.logo}</div>
              <div>
                <div className="detail-title">
                  <h1>{job.title}</h1>
                  {job.featured ? <span className="featured"><Sparkles size={13}/> Destaque</span> : null}
                </div>
                <p className="company-name">{job.company} <BadgeCheck size={15}/></p>
              </div>
            </div>
            <div className="detail-meta">
              <span><MapPin size={17}/>{job.place}</span>
              <span><BriefcaseBusiness size={17}/>{job.type}</span>
              <span><GraduationCap size={17}/>{job.level}</span>
            </div>
            <hr/>
            <ContentBlock title="Sobre a oportunidade">
              {isPartial ? (
                <ContentSkeleton />
              ) : (
                <>
                  <p>{job.description}</p>
                  <p>Você fará parte de um time colaborativo, com autonomia para propor soluções e espaço para aprender continuamente.</p>
                </>
              )}
            </ContentBlock>
            <ContentBlock title="O que você vai fazer">
              {isPartial ? (
                <ContentSkeleton />
              ) : (
                <ul>{(job.responsibilities ?? []).map((x) => <li key={x}><Check size={17}/>{x}</li>)}</ul>
              )}
            </ContentBlock>
            <ContentBlock title="Tecnologias">
              <div className="tags big">{(job.stack ?? []).map((t) => <span key={t}>{t}</span>)}</div>
            </ContentBlock>
            <ContentBlock title={`Sobre a ${job.company}`}>
              {isPartial ? <ContentSkeleton /> : <p>{job.about}</p>}
            </ContentBlock>
          </article>
          <aside className="apply-card">
            <div><span className="muted">Faixa salarial</span><strong>{job.salary}</strong></div>
            <div><span className="muted">Publicada</span><strong><Clock3 size={15}/>{job.posted}</strong></div>
            {showChecking ? (
              <button className="outline apply apply-checking" type="button" disabled>
                Verificando candidatura…
              </button>
            ) : null}
            {showApplied ? (
              <div className="applied">
                <Check size={20}/>
                <div>
                  <strong>{copy.title}</strong>
                  <p>{copy.body}</p>
                </div>
              </div>
            ) : null}
            {showApply ? (
              <button className="primary apply" onClick={apply} disabled={applyBusy}>
                <Send size={17}/> {applyBusy ? "Enviando…" : "Candidatar-se com 1 clique"}
              </button>
            ) : null}
            {showWithdraw ? (
              <button className="outline apply" onClick={() => onWithdraw?.()} disabled={applyBusy}>
                {applyBusy ? "Retirando…" : "Retirar candidatura"}
              </button>
            ) : null}
            {applicationCheckFailed ? (
              <p className="tiny" role="alert">Não foi possível verificar candidatura.</p>
            ) : null}
            {applyError ? <p className="tiny" role="alert">{applyError}</p> : null}
            <p className="tiny">Ao se candidatar, seu perfil será compartilhado com a empresa.</p>
          </aside>
        </div>
      </div>
    </main>
  );
}

function ContentBlock({ title, children }) {
  return <section className="content-block"><h2>{title}</h2>{children}</section>;
}
