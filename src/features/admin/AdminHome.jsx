import React, { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { IngestPanel } from "../ingest/IngestPanel.jsx";
import { canManageAdminJobs } from "./staff-access.js";

export function AdminHome() {
  const { profile } = useOutletContext();
  const isAdmin = canManageAdminJobs(profile?.role);
  const [showIngest, setShowIngest] = useState(false);

  return (
    <>
      <div className="admin-title">
        <div>
          <span className="eyebrow">Área administrativa</span>
          <h1>Painel</h1>
          <p>
            Entrada compatível da área administrativa. Use os atalhos para abrir curadoria ou a gestão de vagas, com
            as mesmas permissões de hoje.
          </p>
        </div>
      </div>
      <div className="admin-home-actions">
        <Link className="primary small" to="/admin/curadoria">
          Abrir curadoria
        </Link>
        {isAdmin ? (
          <Link className="ghost" to="/admin/vagas">
            Gerir vagas
          </Link>
        ) : null}
        {isAdmin ? (
          <button type="button" className={showIngest ? "primary small" : "ghost"} onClick={() => setShowIngest(true)}>
            Ingestão
          </button>
        ) : null}
      </div>
      {isAdmin && showIngest ? <IngestPanel /> : null}
    </>
  );
}
