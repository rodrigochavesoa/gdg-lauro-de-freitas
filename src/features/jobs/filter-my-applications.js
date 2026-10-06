import { applicationStatusLabel } from "./apply-api.js";

/** Ordem do painel: todas, depois os status do contrato de candidatura. */
export const APPLICATION_STATUS_FILTER_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "reviewing", label: applicationStatusLabel("reviewing") },
  { value: "submitted", label: applicationStatusLabel("submitted") },
  { value: "withdrawn", label: applicationStatusLabel("withdrawn") },
  { value: "accepted", label: applicationStatusLabel("accepted") },
  { value: "rejected", label: applicationStatusLabel("rejected") },
];

export function filterMyApplications(rows, { query = "", status = "" } = {}) {
  const normalizedQuery = String(query).trim().toLowerCase();
  return (rows ?? []).filter((row) => {
    if (status && row.status !== status) return false;
    if (!normalizedQuery) return true;
    const haystack = [row.jobTitle, row.companyName, applicationStatusLabel(row.status)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}
