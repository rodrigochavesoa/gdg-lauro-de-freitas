import React from "react";
import { Link, Outlet, useLocation, useOutletContext } from "react-router-dom";
import { canManageAdminJobs } from "./staff-access.js";

export function AdminJobsGate() {
  const context = useOutletContext();
  const { pathname } = useLocation();
  const sectionTitle = pathname.startsWith("/admin/ingestao") ? "Ingestão" : "Gestão de vagas";
  if (!canManageAdminJobs(context?.profile?.role)) {
    return (
      <>
        <div className="admin-title">
          <div>
            <span className="eyebrow">Área administrativa</span>
            <h1>{sectionTitle}</h1>
            <p role="status">
              Esta rota permanece restrita ao papel admin. Curadores e moderadores usam a navegação superior (
              <Link to="/admin/curadoria">Curadoria</Link> ou <Link to="/admin">Painel</Link>).
            </p>
          </div>
        </div>
      </>
    );
  }
  return <Outlet context={context} />;
}
