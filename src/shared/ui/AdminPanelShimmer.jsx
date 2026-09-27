import React from "react";

/** Shimmer DS-06 para listas/detalhe admin (painel, ingestão, curadoria). */
export function AdminPanelShimmer({ variant = "list" }) {
  const rows = variant === "detail" ? 1 : 3;
  return (
    <div className={`admin-ingest__loading${variant === "detail" ? " admin-ingest__loading--detail" : ""}`} aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="admin-ingest__loading-row">
          <span className="admin-dashboard-skeleton-value admin-ingest__loading-line admin-ingest__loading-line--title" />
          <span className="admin-dashboard-skeleton-value admin-ingest__loading-line admin-ingest__loading-line--meta" />
          {variant === "list" ? (
            <span className="admin-dashboard-skeleton-value admin-ingest__loading-line admin-ingest__loading-line--action" />
          ) : null}
        </div>
      ))}
    </div>
  );
}
