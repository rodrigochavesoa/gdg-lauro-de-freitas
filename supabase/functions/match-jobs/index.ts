import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { embed } from "../_shared/gemini.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = request.headers.get("Authorization");
    if (!token) return Response.json({ error: "Não autenticado." }, { status: 401, headers: cors });
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: token } } });
    const { data: { user } } = await client.auth.getUser(token.replace("Bearer ", ""));
    if (!user) return Response.json({ error: "Não autenticado." }, { status: 401, headers: cors });
    const { data: profile, error } = await client.from("profiles").select("headline,bio,skills,preferences").eq("id", user.id).single();
    if (error || !profile) return Response.json({ error: "Perfil não encontrado." }, { status: 404, headers: cors });

    const body = await request.json().catch(() => ({}));
    const query = body.query ?? `${profile.headline ?? ""}\n${profile.bio ?? ""}\nCompetências: ${(profile.skills ?? []).join(", ")}`;
    if (!query.trim()) return Response.json({ error: "Complete o perfil ou informe uma busca." }, { status: 400, headers: cors });
    const vector = await embed(query, "RETRIEVAL_QUERY");
    const { data, error: matchError } = await client.rpc("match_jobs", {
      query_embedding: vector,
      requested_stack: body.stack ?? profile.skills ?? [],
      requested_levels: body.levels ?? [],
      requested_work_model: body.workModel ?? null,
      match_limit: body.limit ?? 20,
    });
    if (matchError) throw matchError;
    return Response.json({ matches: data }, { headers: cors });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro inesperado." }, { status: 500, headers: cors });
  }
});
