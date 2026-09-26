export { ingestNeedsAttention, staffListRowNeedsAttention } from "../ingest/ingest-attention.js";

export const ADMIN_DASHBOARD_SKELETON_METRICS = [
  { id: "pending-curation", label: "Aguardando revisão" },
  { id: "approved", label: "Publicadas" },
  { id: "rejected-jobs", label: "Rejeitadas" },
  { id: "rejected-queue", label: "Na fila" },
  { id: "ingest-attention", label: "Ingestões pendentes" },
];

function confirmedCount(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function summarizeAdminDashboard({
  isAdmin,
  pendingCuration = null,
  approved = null,
  rejectedJobs = null,
  rejectedQueue = null,
  pendingJobs = null,
  ingestAttention = null,
} = {}) {
  const pending = confirmedCount(pendingCuration);
  const approvedCount = confirmedCount(approved);
  const rejected = confirmedCount(rejectedJobs);
  const queue = confirmedCount(rejectedQueue);
  const jobsPending = confirmedCount(pendingJobs);
  const ingest = confirmedCount(ingestAttention);

  const metrics = [
    {
      id: "pending-curation",
      label: "Aguardando revisão",
      hint: "Vagas pendentes na fila de curadoria.",
      value: pending,
    },
  ];

  if (isAdmin) {
    metrics.push(
      { id: "approved", label: "Publicadas", hint: "Vagas aprovadas e visíveis no catálogo público.", value: approvedCount },
      {
        id: "rejected-jobs",
        label: "Rejeitadas",
        hint: "Vagas com status rejeitado (histórico administrativo).",
        value: rejected,
      },
      {
        id: "rejected-queue",
        label: "Na fila",
        hint: "Rejeitadas ainda listadas na curadoria para reenvio ou revisão.",
        value: queue,
      },
      {
        id: "ingest-attention",
        label: "Ingestões pendentes",
        hint: "Ingestões sem materializar ou com falha/expiração recente.",
        value: ingest,
      },
    );
  }

  const ctas = [];
  if (pending != null && pending > 0) {
    ctas.push({
      to: "/admin/curadoria",
      label: `Revisar curadoria (${pending})`,
    });
  }
  if (isAdmin) {
    if (ingest != null && ingest > 0) {
      ctas.push({
        to: "/admin/ingestao",
        label: `Ver ingestões (${ingest})`,
      });
    }
    if (jobsPending != null && jobsPending > 0 && pending === 0) {
      ctas.push({
        to: "/admin/vagas",
        label: `Ver vagas (${jobsPending} pendentes)`,
      });
    }
  }

  return { metrics, ctas };
}
