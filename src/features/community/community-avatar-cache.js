/** Object URLs do proxy community-avatar — dedupe de inflight e uma URL por publicId na sessão. */
const objectUrls = new Map();
/** @type {Map<string, Promise<string>>} */
const inflight = new Map();

export function peekCommunityAvatarObjectUrl(publicId) {
  return objectUrls.get(publicId) ?? null;
}

export function revokeCommunityAvatarObjectUrls() {
  for (const url of objectUrls.values()) {
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
 * @param {() => Promise<Blob>} loadBlob
 * @returns {Promise<string>}
 */
export async function communityAvatarObjectUrl(publicId, loadBlob) {
  const cached = peekCommunityAvatarObjectUrl(publicId);
  if (cached) return cached;
  const pending = inflight.get(publicId);
  if (pending) return pending;

  const request = loadBlob().then((blob) => {
    if (typeof URL.createObjectURL !== "function") {
      throw new Error("Preview de avatar indisponível.");
    }
    const url = URL.createObjectURL(blob);
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
 * @param {(publicId: string) => Promise<Blob>} loadBlobForId
 * @param {{ concurrency?: number }} [options]
 */
export async function warmCommunityAvatarCache(publicIds, loadBlobForId, { concurrency = 6 } = {}) {
  const queue = [...new Set(publicIds)].filter((id) => id && !peekCommunityAvatarObjectUrl(id));
  if (!queue.length) return;
  const limit = Math.max(1, Math.min(concurrency, queue.length));
  const workers = Array.from({ length: limit }, async () => {
    while (queue.length) {
      const publicId = queue.shift();
      if (!publicId) break;
      try {
        await communityAvatarObjectUrl(publicId, () => loadBlobForId(publicId));
      } catch {
        /* o card cai para iniciais se o proxy falhar */
      }
    }
  });
  await Promise.all(workers);
}
