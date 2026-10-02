/** URLs de avatar da comunidade (signed URL HTTPS) — dedupe de inflight e uma entrada por publicId na sessão. */
const objectUrls = new Map();
/** @type {Map<string, Promise<string>>} */
const inflight = new Map();

export function peekCommunityAvatarObjectUrl(publicId) {
  return objectUrls.get(publicId) ?? null;
}

export function revokeCommunityAvatarObjectUrls() {
  for (const url of objectUrls.values()) {
    if (!url.startsWith("blob:")) continue;
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
  objectUrls.clear();
  inflight.clear();
}

/**
 * @param {string} publicId
 * @param {() => Promise<string>} loadUrl
 * @returns {Promise<string>}
 */
export async function communityAvatarObjectUrl(publicId, loadUrl) {
  const cached = peekCommunityAvatarObjectUrl(publicId);
  if (cached) return cached;
  const pending = inflight.get(publicId);
  if (pending) return pending;

  const request = loadUrl().then((url) => {
    if (typeof url !== "string" || !url.startsWith("https://")) {
      throw new Error("Preview de avatar indisponível.");
    }
    objectUrls.set(publicId, url);
    inflight.delete(publicId);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("community-avatar-cache", { detail: { publicId } }));
    }
    return url;
  }).catch((error) => {
    inflight.delete(publicId);
    throw error;
  });

  inflight.set(publicId, request);
  return request;
}

/**
 * Dispara downloads em paralelo (limite de concorrência) para esquentar o cache antes dos cards montarem.
 * @param {string[]} publicIds
 * @param {(publicId: string) => Promise<string>} loadUrlForId
 * @param {{ concurrency?: number }} [options]
 */
export async function warmCommunityAvatarCache(publicIds, loadUrlForId, { concurrency = 6 } = {}) {
  const queue = [...new Set(publicIds)].filter((id) => id && !peekCommunityAvatarObjectUrl(id));
  if (!queue.length) return;
  const limit = Math.max(1, Math.min(concurrency, queue.length));
  const workers = Array.from({ length: limit }, async () => {
    while (queue.length) {
      const publicId = queue.shift();
      if (!publicId) break;
      try {
        await communityAvatarObjectUrl(publicId, () => loadUrlForId(publicId));
      } catch {
        /* o card cai para iniciais se o proxy falhar */
      }
    }
  });
  await Promise.all(workers);
}
