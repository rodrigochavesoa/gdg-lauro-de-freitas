import React from "react";
import { rubricLabel, sortCurationReviews } from "./rubric.js";

export function CurationTimeline({ reviews }) {
  const sorted = sortCurationReviews(reviews);
  if (sorted.length === 0) {
    return <p className="admin-job-list-meta">Ainda sem parecer nesta vaga.</p>;
  }
  return (
    <ol className="curation-timeline">
      {sorted.map((row, index) => (
        <li key={`${row.curation_round}-${row.created_at ?? "t"}-${index}`}>
          Rodada {row.curation_round}: {row.decision === "approve" ? "Aprovar" : "Rejeitar"} · {rubricLabel(row.rubric_code)}
          {row.internal_comment ? ` — ${row.internal_comment}` : ""}
        </li>
      ))}
    </ol>
  );
}
