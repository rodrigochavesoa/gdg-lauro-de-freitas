import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { embed, enrichJob } from "../_shared/gemini.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = request.headers.get("Authorization");
    if (!token) return Response.json({ error: "Não autenticado." }, { status: 401, headers: cors });
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { global: { headers: { Authorization: token } } });
    const { data: { user }, error: authError } = await client.auth.getUser(token.replace("Bearer ", ""));
    if (authError || !user) return Response.json({ error: "Não autenticado." }, { status: 401, headers: cors });
    const { data: profile } = await client.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return Response.json({ error: "Apenas administradores podem enriquecer vagas." }, { status: 403, headers: cors });

    const { jobId } = await request.json();
    if (!jobId) return Response.json({ error: "jobId é obrigatório." }, { status: 400, headers: cors });
    const { data: job, error: jobError } = await client.from("jobs").select("id,title,description,stack").eq("id", jobId).single();
    if (jobError || !job) return Response.json({ error: "Vaga não encontrada." }, { status: 404, headers: cors });

    const enriched = await enrichJob(job);
    const embeddingText = `${job.title}\n${enriched.professional_description}\nRequisitos obrigatórios: ${(enriched.mandatory ?? []).join(", ")}\nTecnologias: ${(enriched.suggested_stack ?? job.stack).join(", ")}`;
    const vector = await embed(embeddingText, "RETRIEVAL_DOCUMENT");
    const { error: updateError } = await client.from("jobs").update({
      enriched_description: enriched.professional_description,
      requirements: { mandatory: enriched.mandatory ?? [], desirable: enriched.desirable ?? [] },
      stack: enriched.suggested_stack?.length ? enriched.suggested_stack : job.stack,
      embedding: vector,
      embedding_model: Deno.env.get("GEMINI_EMBEDDING_MODEL") ?? "gemini-embedding-001",
      embedding_updated_at: new Date().toISOString(),
    }).eq("id", job.id);
    if (updateError) throw updateError;
    return Response.json({ jobId: job.id, enriched: true }, { headers: cors });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro inesperado." }, { status: 500, headers: cors });
  }
});
