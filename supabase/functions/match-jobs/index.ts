const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };

// SEC-MATCH-JOBS-PRIVACY-01: a função fica fechada até o gate MVP-005.
// Não ler perfil (headline, bio, skills, preferences) nem chamar o provedor.
// A ausência de chamada na SPA não é controle: um deploy acidental também responde 403.
Deno.serve((request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  return Response.json(
    { error: "Matching indisponível até o gate de privacidade (MVP-005)." },
    { status: 403, headers: cors },
  );
});
