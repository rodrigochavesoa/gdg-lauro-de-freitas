import React from "react";
import { ArrowUpRight, Mail, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { NEWSLETTER as copy } from "./newsletter-content.js";

function inertActivate(event) {
  event.preventDefault();
}

export function Newsletter({ logged = false }) {
  return (
    <main>
      <section className="hero">
        <div className="shell hero-content">
          <div className="eyebrow"><Mail size={15} /> {copy.eyebrow}</div>
          <h1>{copy.titleBefore}<em>{copy.titleEm}</em></h1>
          <p>{copy.lead}</p>
        </div>
      </section>
      <div className="home-divider" aria-hidden="true">
        <svg className="home-divider__curve" viewBox="0 0 1440 120" preserveAspectRatio="none" focusable="false">
          <path fill="var(--color-surface)" stroke="none" d="M-8 52 C 180 118 380 14 560 64 C 740 112 920 8 1100 58 C 1240 96 1360 22 1448 48 L 1448 128 L -8 128 Z" />
        </svg>
      </div>
      <section className="shell newsletter-layout">
        <form className="job-card newsletter-subscribe" onSubmit={inertActivate} noValidate>
          <h2>{copy.subscribeTitle}</h2>
          <p>{copy.subscribeLead}</p>
          <div className="newsletter-subscribe__fields">
            <label>
              {copy.nameLabel}
              <input type="text" name="name" autoComplete="name" placeholder={copy.namePlaceholder} disabled />
            </label>
            <label>
              {copy.emailLabel}
              <input type="email" name="email" autoComplete="email" placeholder={copy.emailPlaceholder} disabled />
            </label>
            <button className="primary" type="button" aria-disabled="true" onClick={inertActivate}>
              {copy.subscribeCta}
            </button>
          </div>
          <p className="newsletter-subscribe__note">{copy.subscribeNote}</p>
        </form>

        <div className="newsletter-issues">
          <div className="result-head">
            <div>
              <h2>{copy.issuesTitle}</h2>
              <p>{copy.issuesLead}</p>
            </div>
          </div>
          <div className="cards">
            {copy.issues.map((issue) => (
              <article key={issue.id} className="job-card newsletter-issue">
                <div className="job-main">
                  <h3>{issue.title}</h3>
                  <p className="newsletter-issue__date">{issue.date}</p>
                  <p className="newsletter-issue__excerpt">{issue.excerpt}</p>
                  <button className="newsletter-issue__cta" type="button" aria-disabled="true" onClick={inertActivate}>
                    {copy.issueCta}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      {!logged && (
        <section className="cta">
          <div className="shell cta-inner">
            <div>
              <div className="eyebrow light"><Users size={15} /> {copy.ctaEyebrow}</div>
              <h2>{copy.ctaTitle}<br />{copy.ctaTitleBreak}</h2>
              <p>{copy.ctaLead}</p>
            </div>
            <Link to="/login" className="white-button">
              {copy.ctaAction} <ArrowUpRight size={17} />
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
