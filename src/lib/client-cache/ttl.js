/** Freshness compartilhada das listas em memória (catálogo, candidaturas, curadoria, privacidade). */
export const LIST_CACHE_TTL_MS = 30_000;

/** Signed URL do avatar: a URL dura 1 h; o cache em memória expira 5 min antes. */
export const AVATAR_SIGNED_TTL_SEC = 60 * 60;
export const AVATAR_SIGNED_CACHE_TTL_MS = (AVATAR_SIGNED_TTL_SEC - 5 * 60) * 1000;
