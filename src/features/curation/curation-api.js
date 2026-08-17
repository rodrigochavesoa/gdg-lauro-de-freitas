import { getSupabaseBrowserClient } from "../../lib/supabase-client.js";
import { mergeCurationQueue } from "./curation-queue.js";
import { validateCurationReview, validateUrgentPriority } from "./rubric.js";

const STAFF_ROLES = new Set(["admin", "curator", "moderator"]);

const JOB_FIELDS =
  "id,title,status,priority,priority_reason,curation_round,submitted_by,description,stack,level,work_model,location,created_at,rejected_at,companies(name)";

function clientOrThrow() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("VITE_SUPABASE_URL e chave publishable/anon não configuradas.");
  }
  return client;
}

function throwIfError(error) {
  if (error) {
    throw new Error(error.message || "Falha na API do Supabase.");
  }
}

export async function loadCurationProfile() {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data: sessionData } = await client.auth.getUser();
  if (!sessionData?.user) return null;
  const { data, error } = await client
    .from("profiles")
    .select("id,full_name,role")
    .eq("id", sessionData.user.id)
    .maybeSingle();
  if (error || !STAFF_ROLES.has(data?.role)) return null;
  return { ...data, email: sessionData.user.email };
}

export async function signInCuration(email, password) {
  const client = clientOrThrow();
  const { error } = await client.auth.signInWithPassword({ email, password });
  throwIfError(error);
  const profile = await loadCurationProfile();
  if (!profile) {
    await client.auth.signOut();
    throw new Error("Esta conta não tem permissão de curadoria.");
  }
  return profile;
}

export async function signOutCuration() {
  const client = getSupabaseBrowserClient();
  if (client) {
    await client.auth.signOut();
  }
}

export async function loadCurationQueue() {
  const client = clientOrThrow();
  const pending = await client
    .from("jobs")
    .select(JOB_FIELDS)
    .eq("status", "pending");
  throwIfError(pending.error);

  const moderation = await client.from("jobs_needing_moderation").select("id");
  throwIfError(moderation.error);

  const reviews = await client
    .from("job_curation_reviews")
    .select("job_id,curation_round,reviewer_id,decision,rubric_code,created_at")
    .order("created_at", { ascending: true });
  throwIfError(reviews.error);

  const rejected = await client
    .from("jobs")
    .select(JOB_FIELDS)
    .eq("status", "rejected")
    .order("rejected_at", { ascending: false });
  throwIfError(rejected.error);

  const moderationIds = (moderation.data ?? []).map((row) => row.id);
  return {
    queue: mergeCurationQueue(pending.data ?? [], moderationIds),
    rejected: rejected.data ?? [],
    reviews: reviews.data ?? [],
  };
}

export async function submitCurationReview({ jobId, decision, rubricCode, internalComment }) {
  const errors = validateCurationReview({ decision, rubricCode });
  if (errors.length) throw new Error(errors[0]);
  const client = clientOrThrow();
  const { data, error } = await client.rpc("submit_curation_review", {
    p_job_id: jobId,
    p_decision: decision,
    p_rubric_code: rubricCode.trim(),
    p_internal_comment: String(internalComment ?? "").trim() || null,
  });
  throwIfError(error);
  return data;
}

export async function resubmitJobForCuration(jobId) {
  if (!jobId) throw new Error("Vaga para reenvio não informada.");
  const client = clientOrThrow();
  const { data, error } = await client.rpc("resubmit_job_for_curation", { p_job_id: jobId });
  throwIfError(error);
  return data;
}

export async function setJobCurationPriority(jobId, priority, reason) {
  if (priority !== "normal" && priority !== "urgent") {
    throw new Error("Prioridade inválida.");
  }
  if (priority === "urgent") {
    const reasonError = validateUrgentPriority(reason);
    if (reasonError) throw new Error(reasonError);
  }
  const client = clientOrThrow();
  const { data, error } = await client.rpc("set_job_curation_priority", {
    p_job_id: jobId,
    p_priority: priority,
    p_reason: priority === "urgent" ? String(reason).trim() : null,
  });
  throwIfError(error);
  return data;
}

/** Realtime na tabela jobs; o chamador dá unsubscribe no unmount. */
export function subscribeCurationJobs(onChange) {
  const client = getSupabaseBrowserClient();
  if (!client) return () => {};
  const channel = client
    .channel("curation-jobs-queue")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "jobs" },
      () => {
        onChange();
      },
    )
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
