import { getSupabaseBrowserClient } from "../../lib/supabase-client.js";
import { throwStaffApiError } from "../../lib/staff-api-errors.js";

function clientOrThrow() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("VITE_SUPABASE_URL e chave publishable/anon não configuradas.");
  }
  return client;
}

function throwIfError(error) {
  throwStaffApiError(error);
}

async function countJobsByStatus(status) {
  const client = clientOrThrow();
  const { count, error } = await client
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", status);
  throwIfError(error);
  return count ?? 0;
}

export async function loadAdminDashboardJobCounts({ isAdmin }) {
  if (!isAdmin) {
    const pendingCuration = await countJobsByStatus("pending");
    return {
      pendingCuration,
      approved: 0,
      rejectedJobs: 0,
      rejectedQueue: 0,
      pendingJobs: pendingCuration,
    };
  }

  const [pendingCuration, approved, rejected] = await Promise.all([
    countJobsByStatus("pending"),
    countJobsByStatus("approved"),
    countJobsByStatus("rejected"),
  ]);

  return {
    pendingCuration,
    approved,
    rejectedJobs: rejected,
    rejectedQueue: rejected,
    pendingJobs: pendingCuration,
  };
}

/** Contagem no servidor. Não baixa job_ingestions nem o histórico de tentativas. */
export async function countIngestionsNeedingAttention() {
  const client = clientOrThrow();
  const { data, error } = await client.rpc("count_job_ingestions_needing_attention");
  throwIfError(error);
  const count = Number(data ?? 0);
  return Number.isFinite(count) ? count : 0;
}

/** Contadores enxutos para o painel — sem descrições, pareceres ou payloads completos. */
export async function loadAdminDashboardSummary({ isAdmin }) {
  const jobsPromise = loadAdminDashboardJobCounts({ isAdmin });
  if (!isAdmin) {
    const jobs = await jobsPromise;
    return { ...jobs, ingestAttention: 0 };
  }

  const [jobs, ingestAttention] = await Promise.all([jobsPromise, countIngestionsNeedingAttention()]);
  return { ...jobs, ingestAttention };
}
