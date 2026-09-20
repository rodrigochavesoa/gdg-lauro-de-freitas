export const STAFF_ROLES = new Set(["admin", "curator", "moderator"]);

export function isStaffRole(role) {
  return STAFF_ROLES.has(role);
}

/** Gestão de vagas na UI: mesmo recorte atual (`isAdmin`), sem ampliar curator/moderator. */
export function canManageAdminJobs(role) {
  return role === "admin";
}

export function toCurationProfile(authProfile, session) {
  if (!session?.user || !isStaffRole(authProfile?.role)) return null;
  return {
    id: authProfile.id ?? session.user.id,
    full_name: authProfile.full_name,
    role: authProfile.role,
    email: session.user.email ?? authProfile.email,
  };
}

export function isAdminAreaPath(pathname) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
