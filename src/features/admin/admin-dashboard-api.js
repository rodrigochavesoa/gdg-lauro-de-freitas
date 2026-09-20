import { getSupabaseBrowserClient } from "../../lib/supabase-client.js";
import { formatStaffPrivilegedApiError } from "../auth/staff-mfa.js";
import { ingestNeedsAttention } from "./admin-dashboard.js";

function clientOrThrow() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("VITE_SUPABASE_URL e chave publishable/anon não configuradas.");
  }
  return client;
}

function throwIfError(error) {
  if (error) {
    throw new Error(formatStaffPrivilegedApiError(error.message) || error.message || "Falha ao carregar o painel.");
  }
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

async function countIngestionsNeedingAttention() {
  const client = clientOrThrow();
  const { data, error } = await client
    .from("job_ingestions")
    .select("id, job_id, job_ingestion_attempts(outcome, created_at)");
  throwIfError(error);
  return (data ?? []).filter(ingestNeedsAttention).length;
}

/** Contadores enxutos para o painel — sem descrições, pareceres ou payloads completos. */
export async function loadAdminDashboardSummary({ isAdmin }) {
  if (!isAdmin) {
    const pendingCuration = await countJobsByStatus("pending");
    return {
      pendingCuration,
      approved: 0,
      rejectedJobs: 0,
      rejectedQueue: 0,
      pendingJobs: pendingCuration,
      ingestAttention: 0,
    };
  }

  const [pendingCuration, approved, rejected, ingestAttention] = await Promise.all([
    countJobsByStatus("pending"),
    countJobsByStatus("approved"),
    countJobsByStatus("rejected"),
    countIngestionsNeedingAttention(),
  ]);

  return {
    pendingCuration,
    approved,
    rejectedJobs: rejected,
    rejectedQueue: rejected,
    pendingJobs: pendingCuration,
    ingestAttention,
  };
}
