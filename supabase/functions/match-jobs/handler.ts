export const MATCH_JOBS_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

/** Fechado até MVP-005. Não lê perfil e não chama provedor. */
export function matchJobsGate(request: Request): Response {
  if (request.method === "OPTIONS") return new Response("ok", { headers: MATCH_JOBS_CORS });
  return Response.json(
    { error: "Matching indisponível até o gate de privacidade (MVP-005)." },
    { status: 403, headers: MATCH_JOBS_CORS },
  );
}
