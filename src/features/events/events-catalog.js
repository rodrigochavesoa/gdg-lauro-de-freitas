import { DEVFEST_2026 } from "./devfest-2026-content.js";
import { DEVOPSDAYS_SALVADOR_2026 } from "./devopsdays-salvador-2026-content.js";

export const EVENTS_INDEX = {
  eyebrow: "Comunidade tech na Bahia",
  title: "Eventos",
  lead: "Encontros presenciais para aprender, conectar e construir junto.",
  viewEventLabel: "Ver evento",
};

export const EVENTS = [DEVFEST_2026, DEVOPSDAYS_SALVADOR_2026];

export function findEventBySlug(slug) {
  return EVENTS.find((event) => event.slug === slug) ?? null;
}

export function eventSummaries() {
  return EVENTS.map((event) => ({
    slug: event.slug,
    title: event.title,
    datetimeLabel: event.datetimeLabel,
    location: event.location,
    bannerThumb: event.banner.src,
    bannerWidth: event.banner.width,
    bannerHeight: event.banner.height,
    registerUrl: event.registerUrl,
  }));
}
