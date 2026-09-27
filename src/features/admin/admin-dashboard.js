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

function attentionDetail(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Próxima ação do painel, na ordem já definida por `summarizeAdminDashboard`.
 * Não cria métrica: curadoria, ingestão e vagas só entram quando o CTA correspondente existe.
 */
export function describeAdminDashboardFocus({
  isAdmin = false,
  pendingCuration = null,
  pendingJobs = null,
  ingestAttention = null,
  jobsFailed = false,
  ingestFailed = false,
} = {}) {
  const pending = confirmedCount(pendingCuration);
  const jobsPending = confirmedCount(pendingJobs);
  const ingest = confirmedCount(ingestAttention);

  if (jobsFailed) return { state: "unavailable" };
  if (pending == null) return { state: "loading" };

  const priority = summarizeAdminDashboard({
    isAdmin,
    pendingCuration: pending,
    pendingJobs: jobsPending,
    ingestAttention: ingestFailed ? null : ingest,
  }).ctas[0] ?? null;

  if (priority?.to === "/admin/curadoria") {
    return {
      state: "attention",
      title: "Curadoria",
      detail: attentionDetail(pending, "vaga aguarda revisão", "vagas aguardam revisão"),
      href: priority.to,
      ctaLabel: "Revisar fila",
      count: pending,
    };
  }

  if (isAdmin && (ingest == null || ingestFailed)) {
    return { state: ingestFailed ? "unavailable" : "loading" };
  }

  if (priority?.to === "/admin/ingestao") {
    return {
      state: "attention",
      title: "Ingestões pendentes",
      detail: attentionDetail(ingest, "ingestão pendente", "ingestões pendentes"),
      href: priority.to,
      ctaLabel: priority.label,
      count: ingest,
    };
  }

  if (priority?.to === "/admin/vagas") {
    return {
      state: "attention",
      title: "Vagas",
      detail: attentionDetail(jobsPending, "vaga pendente", "vagas pendentes"),
      href: priority.to,
      ctaLabel: priority.label,
      count: jobsPending,
    };
  }

  return {
    state: "clear",
    title: "Em dia",
    detail: "Fila de revisão em dia",
  };
}
