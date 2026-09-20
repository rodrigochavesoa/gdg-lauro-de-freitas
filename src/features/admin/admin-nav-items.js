const ADMIN_STAFF_ROLES = ["admin", "curator", "moderator"];
const ADMIN_JOB_MANAGER_ROLES = ["admin"];

function isJobsListPath(pathname) {
  if (pathname === "/admin/vagas") return true;
  if (pathname === "/admin/vagas/nova") return false;
  return pathname.startsWith("/admin/vagas/");
}

/** @typedef {{ id: string, to: string, label: string, roles: string[], end?: boolean, isActive?: (pathname: string) => boolean }} AdminNavItem */

/** @type {AdminNavItem[]} */
export const ADMIN_NAV_ITEMS = [
  { id: "panel", to: "/admin", end: true, label: "Painel", roles: ADMIN_STAFF_ROLES },
  { id: "curation", to: "/admin/curadoria", label: "Curadoria", roles: ADMIN_STAFF_ROLES },
  { id: "jobs", to: "/admin/vagas", label: "Vagas", roles: ADMIN_JOB_MANAGER_ROLES, isActive: isJobsListPath },
  { id: "publish", to: "/admin/vagas/nova", label: "Publicar", roles: ADMIN_JOB_MANAGER_ROLES },
  { id: "ingest", to: "/admin/ingestao", label: "Ingestão", roles: ADMIN_JOB_MANAGER_ROLES },
];

export function adminNavItemsForRole(role) {
  if (!role) return [];
  return ADMIN_NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function isAdminNavItemActive(pathname, item) {
  if (item.isActive) return item.isActive(pathname);
  if (item.end) return pathname === "/admin" || pathname === "/admin/";
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
