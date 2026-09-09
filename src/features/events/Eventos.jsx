import React from "react";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { DEVFEST_2026 as event } from "./devfest-2026-content.js";

function isExternalHttp(href) {
  return href.startsWith("http://") || href.startsWith("https://");
}

export function Eventos() {
  return (
    <main>
      <section className="hero">
        <div className="shell hero-content">
          <img
            className="event-banner"
            src={event.banner.src}
            alt={event.banner.alt}
            width={event.banner.width}
            height={event.banner.height}
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </div>
      </section>
      <div className="home-divider" aria-hidden="true">
        <svg className="home-divider__curve" viewBox="0 0 1440 120" preserveAspectRatio="none" focusable="false">
          <path fill="var(--color-surface)" stroke="none" d="M-8 52 C 180 118 380 14 560 64 C 740 112 920 8 1100 58 C 1240 96 1360 22 1448 48 L 1448 128 L -8 128 Z" />
        </svg>
      </div>
      <section className="shell event-layout">
        <div className="job-card event-card event-summary">
          <div className="event-summary__meta">
            <h1>{event.title}</h1>
            <p className="event-summary__datetime">
              <CalendarDays size={17} aria-hidden="true" />
              <span>{event.datetimeLabel}</span>
            </p>
            <span className="featured">{event.format}</span>
            <p className="event-summary__location">
              <MapPin size={17} aria-hidden="true" />
              <span>{event.location}</span>
            </p>
          </div>
          <div className="event-summary__cta">
            <a
              className="primary"
              href={event.registerUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {event.registerLabel} <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          </div>
        </div>

        <article className="job-card event-card event-about" aria-labelledby="event-about-title">
          <h2 id="event-about-title">{event.aboutTitle}</h2>
          {event.intro.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {event.pillars.map((pillar) => (
            <div key={pillar.title} className="event-about__pillar">
              <h3>{pillar.emoji} {pillar.title}</h3>
              <p>{pillar.body}</p>
            </div>
          ))}
          <p>{event.closing}</p>
          <ul className="event-about__facts">
            {event.facts.map((fact) => (
              <li key={fact.label}>
                <span aria-hidden="true">{fact.emoji}</span>
                <span>{fact.label}: {fact.value}</span>
              </li>
            ))}
          </ul>
          <p>
            Mais informações:{" "}
            <a href={event.moreInfoUrl} target="_blank" rel="noopener noreferrer">
              {event.moreInfoLabel}
            </a>
          </p>
        </article>

        <div className="job-card event-card event-organizer" aria-labelledby="event-organizer-title">
          <h2 id="event-organizer-title">{event.organizerHeading}</h2>
          <div className="event-organizer__brand">
            <img
              src={event.organizer.logoSrc}
              alt={event.organizer.logoAlt}
              width={48}
              height={48}
              loading="lazy"
              decoding="async"
            />
            <p>{event.organizer.name}</p>
          </div>
          <div className="event-organizer__actions">
            {event.organizer.links.map((link) => (
              <a
                key={link.href}
                className="outline"
                href={link.href}
                {...(isExternalHttp(link.href)
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
