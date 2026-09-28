import { getSupabaseBrowserClient } from "../../lib/supabase-client.js";
import { throwStaffApiError } from "../../lib/staff-api-errors.js";

function clientOrThrow() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("VITE_SUPABASE_URL e chave publishable/anon não configuradas.");
  }
  return client;
}

function finiteCount(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const count = Number(value);
    if (Number.isFinite(count)) return count;
  }
  return null;
}

/** Uma RPC para o painel. Null de ingestão permanece null; não vira 0. */
export async function loadAdminDashboardSummary({ isAdmin }) {
  const client = clientOrThrow();
  const { data, error } = await client.rpc("get_admin_dashboard_summary");
  throwStaffApiError(error);
  const row = data && typeof data === "object" ? data : {};
  const pending = finiteCount(row.pending_curation);
  if (pending == null) {
    throw new Error("Resumo do painel sem contagem de curadoria.");
  }
  const ingestAvailable = isAdmin && row.ingest_available === true;
  const ingestAttention = ingestAvailable ? finiteCount(row.ingest_attention) : null;
  return {
    pendingCuration: pending,
    pendingJobs: finiteCount(row.pending_jobs) ?? pending,
    approved: isAdmin ? finiteCount(row.approved) : 0,
    rejectedJobs: isAdmin ? finiteCount(row.rejected_jobs) : 0,
    rejectedQueue: isAdmin ? finiteCount(row.rejected_queue) : 0,
    ingestAttention,
    ingestAvailable: ingestAvailable && ingestAttention != null,
  };
}
