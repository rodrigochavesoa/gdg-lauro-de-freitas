import { latestIngestionAttempt } from "../ingest/ingest-api.js";

export function ingestNeedsAttention(ingestion) {
  const attempt = latestIngestionAttempt(ingestion);
  if (!attempt) return !ingestion?.job_id;
  return attempt.outcome === "failed" || attempt.outcome === "expired";
}

export const ADMIN_DASHBOARD_SKELETON_METRICS = [
  { id: "pending-curation", label: "Aguardando revisão" },
  { id: "approved", label: "Publicadas" },
  { id: "rejected-jobs", label: "Rejeitadas" },
  { id: "rejected-queue", label: "Na fila" },
  { id: "ingest-attention", label: "Ingestões pendentes" },
];

export function summarizeAdminDashboard({
  isAdmin,
  pendingCuration = 0,
  approved = 0,
  rejectedJobs = 0,
  rejectedQueue = 0,
  pendingJobs = 0,
  ingestAttention = 0,
}) {
  const metrics = [
    {
      id: "pending-curation",
      label: "Aguardando revisão",
      hint: "Vagas pendentes na fila de curadoria.",
      value: pendingCuration,
    },
  ];

  if (isAdmin) {
    metrics.push(
      { id: "approved", label: "Publicadas", hint: "Vagas aprovadas e visíveis no catálogo público.", value: approved },
      {
        id: "rejected-jobs",
        label: "Rejeitadas",
        hint: "Vagas com status rejeitado (histórico administrativo).",
        value: rejectedJobs,
      },
      {
        id: "rejected-queue",
        label: "Na fila",
        hint: "Rejeitadas ainda listadas na curadoria para reenvio ou revisão.",
        value: rejectedQueue,
      },
      {
        id: "ingest-attention",
        label: "Ingestões pendentes",
        hint: "Ingestões sem materializar ou com falha/expiração recente.",
        value: ingestAttention,
      },
    );
  }

  const ctas = [];
  if (pendingCuration > 0) {
    ctas.push({
      to: "/admin/curadoria",
      label: `Revisar curadoria (${pendingCuration})`,
    });
  }
  if (isAdmin) {
    if (ingestAttention > 0) {
      ctas.push({
        to: "/admin/ingestao",
        label: `Ver ingestões (${ingestAttention})`,
      });
    }
    if (pendingJobs > 0 && pendingCuration === 0) {
      ctas.push({
        to: "/admin/vagas",
        label: `Ver vagas (${pendingJobs} pendentes)`,
      });
    }
  }

  return { metrics, ctas };
}
