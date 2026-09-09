import React from "react";
import { CalendarDays, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { EVENTS_INDEX, eventSummaries } from "./events-catalog.js";

export function EventosIndex() {
  const events = eventSummaries();

  return (
    <main>
      <section className="hero">
        <div className="shell hero-content">
          <div className="eyebrow"><CalendarDays size={15} /> {EVENTS_INDEX.eyebrow}</div>
          <h1>{EVENTS_INDEX.title}</h1>
          <p>{EVENTS_INDEX.lead}</p>
        </div>
      </section>
      <div className="home-divider" aria-hidden="true">
        <svg className="home-divider__curve" viewBox="0 0 1440 120" preserveAspectRatio="none" focusable="false">
          <path fill="var(--color-surface)" stroke="none" d="M-8 52 C 180 118 380 14 560 64 C 740 112 920 8 1100 58 C 1240 96 1360 22 1448 48 L 1448 128 L -8 128 Z" />
        </svg>
      </div>
      <section className="shell event-layout">
        <div className="cards events-index__cards">
          {events.map((event) => (
            <article key={event.slug} className="job-card event-index-card">
              <img
                className={event.bannerFit === "contain" ? "event-index-card__thumb event-index-card__thumb--contain" : "event-index-card__thumb"}
                src={event.bannerThumb}
                alt=""
                width={640}
                height={180}
                loading="lazy"
                decoding="async"
              />
              <h2>{event.title}</h2>
              <p className="event-index-card__meta">
                <CalendarDays size={16} aria-hidden="true" />
                <span>{event.datetimeLabel}</span>
              </p>
              <p className="event-index-card__meta">
                <MapPin size={16} aria-hidden="true" />
                <span>{event.location}</span>
              </p>
              <Link className="outline" to={`/eventos/${event.slug}`}>
                {EVENTS_INDEX.viewEventLabel}
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
