import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Filter,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toggleFilterValue } from "../../lib/filter-jobs.js";
import {
  EVENT_STATUS_FILTERS,
  EVENT_STATUS_LABELS,
  EVENT_STATUS_ONGOING,
  EVENT_STATUS_PAST,
  filterEvents,
  getEventStatus,
  SORT_LATEST,
  SORT_SOONEST,
  sortEvents,
} from "../../lib/filter-events.js";
import { EVENTS_INDEX, EVENT_SUMMARIES } from "./events-catalog.js";

const FORMAT_FILTERS = ["Presencial", "Híbrido", "Online"];
const POPULAR_QUERIES = [
  { label: "DevFest", query: "DevFest" },
  { label: "DevOpsDays", query: "DevOpsDays" },
  { label: "Salvador", query: "Salvador" },
  { label: "Lauro", query: "Lauro" },
];

function statusClassName(status) {
  if (status === EVENT_STATUS_ONGOING) return "event-status event-status--ongoing";
  if (status === EVENT_STATUS_PAST) return "event-status event-status--past";
  return "featured";
}

export function EventosIndex() {
  const catalog = EVENT_SUMMARIES;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState([]);
  const [format, setFormat] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState(SORT_SOONEST);

  const filtered = useMemo(
    () => filterEvents(catalog, { query, status, format }),
    [catalog, query, status, format],
  );
  const visibleEvents = useMemo(
    () => sortEvents(filtered, sortOrder),
    [filtered, sortOrder],
  );

  const toggle = (item, values, setter) => setter(toggleFilterValue(item, values));
  const reset = () => {
    setQuery("");
    setStatus([]);
    setFormat([]);
  };
  const activeFilterCount = status.length + format.length;

  return (
    <main>
      <section className="hero">
        <div className="shell hero-content">
          <div className="eyebrow"><CalendarDays size={15} /> {EVENTS_INDEX.eyebrow}</div>
          <h1>{EVENTS_INDEX.title}</h1>
          <p>{EVENTS_INDEX.lead}</p>
          <div className="searchbox">
            <Search size={21} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Evento, cidade ou organizador"
            />
            <button className="primary" type="button" onClick={() => {}}>
              Buscar eventos <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="popular">
            Populares:
            {POPULAR_QUERIES.map((chip) => (
              <button key={chip.query} type="button" onClick={() => setQuery(chip.query)}>
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </section>
      <div className="home-divider" aria-hidden="true">
        <svg className="home-divider__curve" viewBox="0 0 1440 120" preserveAspectRatio="none" focusable="false">
          <path fill="var(--color-surface)" stroke="none" d="M-8 52 C 180 118 380 14 560 64 C 740 112 920 8 1100 58 C 1240 96 1360 22 1448 48 L 1448 128 L -8 128 Z" />
        </svg>
      </div>
      <section className="shell jobs-layout">
        <aside className={`filters ${filterOpen ? "open" : ""}`}>
          <div className="filter-head">
            <h2><Filter size={18} /> Filtros</h2>
            <button type="button" onClick={reset}>Limpar</button>
            <button className="close-filter" type="button" onClick={() => setFilterOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <FilterGroup
            label="Status"
            values={EVENT_STATUS_FILTERS}
            active={status}
            toggle={(value) => toggle(value, status, setStatus)}
            labels={EVENT_STATUS_LABELS}
          />
          <FilterGroup
            label="Formato"
            values={FORMAT_FILTERS}
            active={format}
            toggle={(value) => toggle(value, format, setFormat)}
          />
        </aside>
        <div className="job-content">
          <div className="result-head">
            <div>
              <h2>Eventos em destaque</h2>
              <p>{visibleEvents.length} eventos encontrados</p>
            </div>
            <button className="filter-mobile" type="button" onClick={() => setFilterOpen(true)}>
              <Filter size={16} /> Filtros {activeFilterCount > 0 && <b>{activeFilterCount}</b>}
            </button>
            <SortMenu value={sortOrder} onChange={setSortOrder} />
          </div>
          <div className="cards events-index__cards">
            {visibleEvents.map((event) => (
              <EventIndexCard key={event.slug} event={event} />
            ))}
            {visibleEvents.length === 0 && (
              <div className="empty">
                <Search size={32} />
                <h3>Nenhum evento encontrado</h3>
                <p>Tente remover alguns filtros ou buscar outro termo.</p>
                <button className="outline" type="button" onClick={reset}>Limpar filtros</button>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function EventIndexCard({ event }) {
  const status = getEventStatus(event);

  return (
    <article className="job-card event-index-card">
      <div className="event-index-card__thumb-wrap">
        <img
          className="event-index-card__thumb"
          src={event.bannerThumb}
          alt=""
          width={event.bannerWidth}
          height={event.bannerHeight}
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="job-title">
        <h2>{event.title}</h2>
        <span className={statusClassName(status)}>{EVENT_STATUS_LABELS[status]}</span>
      </div>
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
  );
}

function SortMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const label = value === SORT_LATEST ? "Mais distantes" : "Próximos primeiro";

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
        aria-controls="events-sort-menu"
        onClick={() => setOpen((current) => !current)}
      >
        {label} <ChevronDown size={16} />
      </button>
      {open && (
        <ul id="events-sort-menu" className="sort-menu" role="listbox" aria-label="Ordenar eventos">
          <li>
            <button type="button" role="option" aria-selected={value === SORT_SOONEST} onClick={() => choose(SORT_SOONEST)}>
              Próximos primeiro
            </button>
          </li>
          <li>
            <button type="button" role="option" aria-selected={value === SORT_LATEST} onClick={() => choose(SORT_LATEST)}>
              Mais distantes
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

function FilterGroup({ label, values, active, toggle, labels }) {
  return (
    <div className="filter-group">
      <h3>{label}</h3>
      {values.map((value) => (
        <label key={value} className="checkline">
          <input type="checkbox" checked={active.includes(value)} onChange={() => toggle(value)} />
          <span className="check"><Check size={13} /></span>
          {labels?.[value] ?? value}
        </label>
      ))}
    </div>
  );
}
