import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { canManageAdminJobs } from "./staff-access.js";

function tabClass(isActive) {
  return isActive ? "primary small" : "ghost";
}

function isJobsListPath(pathname) {
  if (pathname === "/admin/vagas") return true;
  if (pathname === "/admin/vagas/nova") return false;
  return pathname.startsWith("/admin/vagas/");
}

export function AdminNav({ profile }) {
  const { pathname } = useLocation();
  const showJobs = canManageAdminJobs(profile?.role);

  return (
    <nav className="admin-tabs" aria-label="Seções da área administrativa">
      <NavLink to="/admin" end className={({ isActive }) => tabClass(isActive)}>
        Painel
      </NavLink>
      <NavLink to="/admin/curadoria" className={({ isActive }) => tabClass(isActive)}>
        Curadoria
      </NavLink>
      {showJobs ? (
        <NavLink to="/admin/vagas" className={() => tabClass(isJobsListPath(pathname))}>
          Vagas
        </NavLink>
      ) : null}
      {showJobs ? (
        <NavLink to="/admin/vagas/nova" className={({ isActive }) => tabClass(isActive)}>
          Publicar
        </NavLink>
      ) : null}
      {showJobs ? (
        <NavLink to="/admin/ingestao" className={({ isActive }) => tabClass(isActive)}>
          Ingestão
        </NavLink>
      ) : null}
    </nav>
  );
}
