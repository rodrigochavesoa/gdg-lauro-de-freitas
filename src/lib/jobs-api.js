import { mapJob } from "./map-job.js";
import { getSupabaseBrowserClient } from "./supabase-client.js";

const JOB_SELECT = `
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

export async function loadApprovedJobs() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("VITE_SUPABASE_URL e chave publishable/anon não configuradas.");
  }

  const { data, error } = await client
    .from("jobs")
    .select(JOB_SELECT)
    .eq("status", "approved")
    .order("approved_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapJob);
}
