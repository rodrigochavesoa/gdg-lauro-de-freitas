import { getSupabaseBrowserClient } from "../../lib/supabase-client.js";
import { throwStaffApiError } from "../../lib/staff-api-errors.js";

function clientOrThrow() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("VITE_SUPABASE_URL e chave publishable/anon não configuradas.");
  }
  return client;
}

function countOrZero(value) {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? count : 0;
}

/** Uma RPC para o painel. O servidor zera campos de admin quando a sessão não é admin AAL2. */
export async function loadAdminDashboardSummary({ isAdmin }) {
  const client = clientOrThrow();
  const { data, error } = await client.rpc("get_admin_dashboard_summary");
  throwStaffApiError(error);
  const row = data && typeof data === "object" ? data : {};
  const pending = countOrZero(row.pending_curation);
  return {
    pendingCuration: pending,
    pendingJobs: countOrZero(row.pending_jobs ?? pending),
    approved: isAdmin ? countOrZero(row.approved) : 0,
    rejectedJobs: isAdmin ? countOrZero(row.rejected_jobs) : 0,
    rejectedQueue: isAdmin ? countOrZero(row.rejected_queue) : 0,
    ingestAttention: isAdmin ? countOrZero(row.ingest_attention) : 0,
  };
}
