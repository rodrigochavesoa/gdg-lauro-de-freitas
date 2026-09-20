import React from "react";
import { IngestPanel } from "../ingest/IngestPanel.jsx";

export function AdminIngestRoute() {
  return (
    <>
      <div className="admin-title">
        <div>
          <span className="eyebrow">Área administrativa</span>
          <h1>Ingestão</h1>
          <p>Entrada controlada de vagas em homologação. Itens seguem para curadoria como pendentes.</p>
        </div>
      </div>
      <IngestPanel />
    </>
  );
}
