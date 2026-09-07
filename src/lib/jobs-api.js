import { mapJob } from "./map-job.js";
import { getSupabaseBrowserClient } from "./supabase-client.js";

const JOB_DETAIL_SELECT = `
  id,
  title,
  description,
  requirements,
  stack,
  level,
  work_model,
  location,
  status,
  approved_at,
  created_at,
  companies ( name, description )
`;

const JOB_LIST_SELECT = `
  id,
  title,
  stack,
  level,
  work_model,
  location,
  status,
  approved_at,
  created_at,
  companies ( name )
`;

export async function loadApprovedJobs() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("VITE_SUPABASE_URL e chave publishable/anon não configuradas.");
  }

  const { data, error } = await client
    .from("jobs")
    .select(JOB_LIST_SELECT)
    .eq("status", "approved")
    .order("approved_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapJob);
}

export async function loadApprovedJob(id) {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("VITE_SUPABASE_URL e chave publishable/anon não configuradas.");
  }

  const { data, error } = await client
    .from("jobs")
    .select(JOB_DETAIL_SELECT)
    .eq("status", "approved")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapJob(data) : null;
}
