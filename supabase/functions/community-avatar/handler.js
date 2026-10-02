const PUBLIC_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const CORS_METHODS = "GET, OPTIONS";
const ALLOWED_CORS_HEADERS = new Set(["authorization", "apikey", "content-type", "x-client-info"]);
const CORS_HEADERS = [...ALLOWED_CORS_HEADERS].join(", ");

function originHeaders(origin, allowed) {
  if (!origin || !allowed.has(origin)) return null;
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": CORS_METHODS,
    "access-control-allow-headers": CORS_HEADERS,
    "access-control-max-age": "600",
    vary: "Origin",
  };
}

function jsonError(status, message, extraHeaders = {}) {
  return Response.json({ error: message }, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...extraHeaders },
  });
}

function boundedStream(body, maxBytes) {
  let total = 0;
  return body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > maxBytes) throw new Error("avatar response too large");
      controller.enqueue(chunk);
    },
  }));
}

function allowedPreflight(request) {
  const requestedMethod = request.headers.get("access-control-request-method");
  if (requestedMethod && requestedMethod.toUpperCase() !== "GET") return false;
  const requestedHeaders = (request.headers.get("access-control-request-headers") ?? "")
    .split(",")
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);
  return requestedHeaders.every((header) => ALLOWED_CORS_HEADERS.has(header));
}

export function createCommunityAvatarHandler({
  allowedOrigins = [],
  verifyAccessToken,
  getPrivateAvatarPath,
  downloadPrivateAvatar,
}) {
  const allowed = new Set(allowedOrigins.filter((origin) => typeof origin === "string" && origin.length > 0));

  return async function handleCommunityAvatar(request) {
    const origin = request.headers.get("origin");
    const cors = originHeaders(origin, allowed);
    if (!cors) return jsonError(403, "Origem não autorizada.");
    if (request.method === "OPTIONS") {
      if (!allowedPreflight(request)) return jsonError(403, "Preflight não autorizado.", cors);
      return new Response(null, { status: 204, headers: { ...cors, "cache-control": "no-store" } });
    }
    if (request.method !== "GET") return jsonError(405, "Método não permitido.", { ...cors, allow: CORS_METHODS });

    const authorization = request.headers.get("authorization") ?? "";
    const tokenMatch = /^Bearer\s+([^\s]+)$/i.exec(authorization);
    if (!tokenMatch) return jsonError(401, "Autenticação necessária.", cors);

    const requestUrl = new URL(request.url);
    const publicId = requestUrl.searchParams.get("publicId");
    if (PUBLIC_ID_PATTERN.test(publicId ?? "") === false) return jsonError(400, "Solicitação inválida.", cors);

    try {
      const authResult = await verifyAccessToken(tokenMatch[1]);
      const user = authResult?.data?.user;
      if (authResult?.error || !user?.id) return jsonError(401, "Autenticação necessária.", cors);

      const pathResult = await getPrivateAvatarPath(publicId, user.id);
      if (pathResult?.error) {
        if (pathResult.error.code === "PT429" || /rate limit/i.test(pathResult.error.message ?? "")) {
          return jsonError(429, "Limite temporário de consultas atingido.", { ...cors, "retry-after": "60" });
        }
        return jsonError(503, "Imagem temporariamente indisponível.", cors);
      }
      const storagePath = pathResult?.data;
      if (typeof storagePath !== "string" || !storagePath) return jsonError(404, "Perfil não encontrado.", cors);
      const internalAvatarPath = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[A-Za-z0-9._-]+[.](?:jpg|jpeg|png|webp)$/i;
      if (storagePath.includes("..") || !internalAvatarPath.test(storagePath)) {
        return jsonError(503, "Imagem temporariamente indisponível.", cors);
      }

      const imageResponse = await downloadPrivateAvatar(storagePath);
      if (!imageResponse?.ok || !imageResponse.body) {
        return jsonError(imageResponse?.status === 404 ? 404 : 503, "Imagem temporariamente indisponível.", cors);
      }
      const mediaType = (imageResponse.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!ALLOWED_MEDIA_TYPES.has(mediaType)) return jsonError(415, "Formato de imagem não permitido.", cors);
      const contentLength = Number(imageResponse.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > MAX_AVATAR_BYTES) {
        await imageResponse.body.cancel();
        return jsonError(413, "Imagem excede o limite permitido.", cors);
      }

      return new Response(boundedStream(imageResponse.body, MAX_AVATAR_BYTES), {
        status: 200,
        headers: {
          ...cors,
          "cache-control": "private, no-store, max-age=0",
          "content-type": mediaType,
          ...(Number.isFinite(contentLength) && contentLength > 0 ? { "content-length": String(contentLength) } : {}),
          "content-disposition": "inline",
          "x-content-type-options": "nosniff",
        },
      });
    } catch {
      return jsonError(503, "Imagem temporariamente indisponível.", cors);
    }
  };
}
