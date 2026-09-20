import React from "react";
import { Link, Outlet, useOutletContext } from "react-router-dom";
import { canManageAdminJobs } from "./staff-access.js";

export function AdminJobsGate() {
  const context = useOutletContext();
  if (!canManageAdminJobs(context?.profile?.role)) {
    return (
      <>
        <div className="admin-title">
          <div>
            <span className="eyebrow">Área administrativa</span>
            <h1>Gestão de vagas</h1>
            <p role="status">
              Esta rota permanece restrita ao papel admin. Curadores e moderadores continuam pela curadoria; o acesso
              não foi ampliado nesta entrega.
            </p>
          </div>
        </div>
        <div className="admin-home-actions">
          <Link className="primary small" to="/admin/curadoria">
            Abrir curadoria
          </Link>
          <Link className="ghost" to="/admin">
            Voltar ao painel
          </Link>
        </div>
      </>
    );
  }
  return <Outlet context={context} />;
}
