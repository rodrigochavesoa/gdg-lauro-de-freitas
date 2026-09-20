import { latestIngestionAttempt } from "../ingest/ingest-api.js";

export function ingestNeedsAttention(ingestion) {
  const attempt = latestIngestionAttempt(ingestion);
  if (!attempt) return !ingestion?.job_id;
  return attempt.outcome === "failed" || attempt.outcome === "expired";
}

export function summarizeAdminDashboard({ queue = [], rejected = [], jobs = [], ingestions = [], isAdmin }) {
  const pendingCuration = queue.length;
  const metrics = [
    {
      id: "pending-curation",
      label: "Aguardando revisão",
      hint: "Vagas pendentes na fila de curadoria.",
      value: pendingCuration,
    },
  ];

  if (isAdmin) {
    const approved = jobs.filter((job) => job.status === "approved").length;
    const rejectedJobs = jobs.filter((job) => job.status === "rejected").length;
    const ingestAttention = ingestions.filter(ingestNeedsAttention).length;
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
        value: rejected.length,
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
    const ingestAttention = ingestions.filter(ingestNeedsAttention).length;
    if (ingestAttention > 0) {
      ctas.push({
        to: "/admin/ingestao",
        label: `Ver ingestões (${ingestAttention})`,
      });
    }
    const pendingJobs = jobs.filter((job) => job.status === "pending").length;
    if (pendingJobs > 0 && pendingCuration === 0) {
      ctas.push({
        to: "/admin/vagas",
        label: `Ver vagas (${pendingJobs} pendentes)`,
      });
    }
  }

  return { metrics, ctas };
}
