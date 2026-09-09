import { describe, expect, it } from "vitest";
import {
  EVENT_STATUS_ONGOING,
  EVENT_STATUS_PAST,
  EVENT_STATUS_UPCOMING,
  filterEvents,
  getEventStatus,
  SORT_LATEST,
  SORT_SOONEST,
  sortEvents,
} from "./filter-events.js";

const DEVFEST_START = "2026-11-07T08:00:00-03:00";
const DEVFEST_END = "2026-11-07T17:30:00-03:00";
const DEVOPS_START = "2026-12-05T08:15:00-03:00";
const DEVOPS_END = "2026-12-05T18:00:00-03:00";

const events = [
  {
    slug: "devfest-lauro-de-freitas-2026",
    title: "Devfest Lauro de Freitas 2026",
    location: "SENAI Lauro de Freitas — Lauro de Freitas — Bahia — Brasil",
    organizerName: "GDG Lauro de Freitas",
    format: "Presencial",
    startsAt: DEVFEST_START,
    endsAt: DEVFEST_END,
  },
  {
    slug: "devopsdays-salvador-2026",
    title: "DevOpsDays Salvador 2026",
    location: "Auditório da UCSAL — Salvador — Bahia — Brasil",
    organizerName: "DevOpsDays Salvador",
    format: "Presencial",
    startsAt: DEVOPS_START,
    endsAt: DEVOPS_END,
  },
];

describe("getEventStatus", () => {
  const windowed = { startsAt: DEVFEST_START, endsAt: DEVFEST_END };

  it("marca Em breve antes do início", () => {
    expect(getEventStatus(windowed, "2026-09-09T19:00:00-03:00")).toBe(EVENT_STATUS_UPCOMING);
    expect(getEventStatus(windowed, "2026-11-07T07:59:59-03:00")).toBe(EVENT_STATUS_UPCOMING);
  });

  it("marca Em andamento no intervalo inclusive", () => {
    expect(getEventStatus(windowed, DEVFEST_START)).toBe(EVENT_STATUS_ONGOING);
    expect(getEventStatus(windowed, "2026-11-07T12:00:00-03:00")).toBe(EVENT_STATUS_ONGOING);
    expect(getEventStatus(windowed, DEVFEST_END)).toBe(EVENT_STATUS_ONGOING);
  });

  it("marca Encerrado depois do término", () => {
    expect(getEventStatus(windowed, "2026-11-07T17:30:01-03:00")).toBe(EVENT_STATUS_PAST);
    expect(getEventStatus(windowed, "2027-01-01T00:00:00-03:00")).toBe(EVENT_STATUS_PAST);
  });
});

describe("filterEvents", () => {
  const now = "2026-09-09T19:00:00-03:00";

  it("retorna todos os eventos sem busca nem filtros", () => {
    expect(filterEvents(events, { now }).map((event) => event.slug)).toEqual([
      "devfest-lauro-de-freitas-2026",
      "devopsdays-salvador-2026",
    ]);
  });

  it("busca por título, cidade, organizador ou slug sem diferenciar maiúsculas", () => {
    expect(filterEvents(events, { query: "devfest", now }).map((event) => event.slug)).toEqual([
      "devfest-lauro-de-freitas-2026",
    ]);
    expect(filterEvents(events, { query: "SALVADOR", now }).map((event) => event.slug)).toEqual([
      "devopsdays-salvador-2026",
    ]);
    expect(filterEvents(events, { query: "lauro", now }).map((event) => event.slug)).toEqual([
      "devfest-lauro-de-freitas-2026",
    ]);
    expect(filterEvents(events, { query: "GDG", now }).map((event) => event.slug)).toEqual([
      "devfest-lauro-de-freitas-2026",
    ]);
  });

  it("filtra por status com datas mockadas", () => {
    expect(
      filterEvents(events, { status: [EVENT_STATUS_UPCOMING], now }).map((event) => event.slug),
    ).toEqual(["devfest-lauro-de-freitas-2026", "devopsdays-salvador-2026"]);
    expect(filterEvents(events, { status: [EVENT_STATUS_PAST], now })).toEqual([]);
    expect(
      filterEvents(events, {
        status: [EVENT_STATUS_ONGOING],
        now: "2026-11-07T12:00:00-03:00",
      }).map((event) => event.slug),
    ).toEqual(["devfest-lauro-de-freitas-2026"]);
    expect(
      filterEvents(events, {
        status: [EVENT_STATUS_PAST],
        now: "2026-12-06T00:00:00-03:00",
      }).map((event) => event.slug),
    ).toEqual(["devfest-lauro-de-freitas-2026", "devopsdays-salvador-2026"]);
  });

  it("filtra por formato e combina com a busca", () => {
    const mixed = [
      ...events,
      { ...events[0], slug: "meetup-online", title: "Meetup Online", format: "Online" },
      { ...events[1], slug: "workshop-hibrido", title: "Workshop Híbrido", format: "Híbrido" },
    ];
    expect(filterEvents(mixed, { format: ["Presencial"], now })).toHaveLength(2);
    expect(filterEvents(mixed, { format: ["Online"], now }).map((event) => event.slug)).toEqual([
      "meetup-online",
    ]);
    expect(filterEvents(mixed, { format: ["Híbrido"], now }).map((event) => event.slug)).toEqual([
      "workshop-hibrido",
    ]);
    expect(filterEvents(mixed, { format: ["Online", "Híbrido"], now })).toHaveLength(2);
    expect(filterEvents(events, { query: "Salvador", format: ["Presencial"], now })).toHaveLength(1);
    expect(filterEvents(events, { query: "inexistente", now })).toEqual([]);
  });
});

describe("sortEvents", () => {
  it("ordena próximos primeiro por startsAt asc", () => {
    expect(sortEvents(events).map((event) => event.slug)).toEqual([
      "devfest-lauro-de-freitas-2026",
      "devopsdays-salvador-2026",
    ]);
    expect(sortEvents(events, SORT_SOONEST).map((event) => event.slug)).toEqual([
      "devfest-lauro-de-freitas-2026",
      "devopsdays-salvador-2026",
    ]);
  });

  it("ordena mais distantes por startsAt desc", () => {
    expect(sortEvents(events, SORT_LATEST).map((event) => event.slug)).toEqual([
      "devopsdays-salvador-2026",
      "devfest-lauro-de-freitas-2026",
    ]);
  });
});
