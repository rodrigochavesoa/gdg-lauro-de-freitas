export const EVENT_STATUS_UPCOMING = "upcoming";
export const EVENT_STATUS_ONGOING = "ongoing";
export const EVENT_STATUS_PAST = "past";

export const EVENT_STATUS_LABELS = {
  [EVENT_STATUS_UPCOMING]: "Em breve",
  [EVENT_STATUS_ONGOING]: "Em andamento",
  [EVENT_STATUS_PAST]: "Encerrado",
};

export const EVENT_STATUS_FILTERS = [
  EVENT_STATUS_UPCOMING,
  EVENT_STATUS_ONGOING,
  EVENT_STATUS_PAST,
];

export const SORT_SOONEST = "soonest";
export const SORT_LATEST = "latest";

function eventTime(value) {
  const parsed = Date.parse(value ?? "");
  return Number.isNaN(parsed) ? null : parsed;
}

function clockFrom(now) {
  if (now == null) return Date.now();
  if (typeof now === "number") return now;
  const parsed = Date.parse(now);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

export function getEventStatus(event, now) {
  const start = eventTime(event?.startsAt);
  const end = eventTime(event?.endsAt);
  const clock = clockFrom(now);

  if (start == null || clock < start) return EVENT_STATUS_UPCOMING;
  if (end == null || clock <= end) return EVENT_STATUS_ONGOING;
  return EVENT_STATUS_PAST;
}

function searchHaystack(event) {
  return [
    event.title,
    event.location,
    event.organizerName ?? event.organizer?.name,
    event.slug,
    event.format,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterEvents(events, { query = "", status = [], format = [], now } = {}) {
  const normalizedQuery = query.toLowerCase();
  const clock = clockFrom(now);

  return events.filter((event) => {
    const searched = searchHaystack(event).includes(normalizedQuery);
    const hasStatus =
      status.length === 0 || status.includes(getEventStatus(event, clock));
    const hasFormat = format.length === 0 || format.includes(event.format);
    return searched && hasStatus && hasFormat;
  });
}

function startTime(event) {
  return eventTime(event?.startsAt) ?? Number.POSITIVE_INFINITY;
}

export function sortEvents(events, order = SORT_SOONEST) {
  const ranked = [...events];
  ranked.sort((left, right) => {
    const delta = startTime(left) - startTime(right);
    return order === SORT_LATEST ? -delta : delta;
  });
  return ranked;
}
