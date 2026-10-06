const METHODS = new Set(["GET", "POST", "OPTIONS"]);
const PHASES = new Set(["list", "detail", "backToList", "leaveAndReturn"]);

const STATUS_CLASSES = new Map([
  [200, "ok"], [201, "ok"], [202, "ok"], [204, "no_content"],
  [400, "bad_request"], [401, "unauthorized"], [403, "forbidden"],
  [404, "not_found"], [405, "method_not_allowed"], [408, "timeout"],
  [429, "rate_limited"], [500, "server_error"], [502, "server_error"],
  [503, "server_error"], [504, "timeout"],
]);

export function normalizeAvatarMethod(value) {
  const method = String(value || "").toUpperCase();
  return METHODS.has(method) ? method : "OTHER";
}

export function normalizeAvatarStatus(value) {
  const status = Number(value);
  return Number.isInteger(status) ? STATUS_CLASSES.get(status) || "other" : "unknown";
}

/** Classifies only fixed endpoint suffixes. Query strings and path identifiers never leave this function. */
export function classifyAvatarRequest(rawUrl, rawMethod) {
  let pathname;
  try {
    pathname = new URL(rawUrl).pathname;
  } catch {
    return null;
  }
  const method = normalizeAvatarMethod(rawMethod);
  if (/\/functions\/v1\/community-avatar$/i.test(pathname)) {
    if (method === "OPTIONS") return { kind: "avatarOptions", method };
    if (method === "GET") return { kind: "avatarGet", method };
    return null;
  }
  const rpc = pathname.match(/\/rest\/v1\/rpc\/(list_community_profiles|get_community_feature_status|get_community_profile)$/i)?.[1]?.toLowerCase();
  if (!rpc) {
    if (/\/storage\/v1\/object\//i.test(pathname) && method === "GET") return { kind: "storageDirect", method };
    return null;
  }
  if (method !== "POST") return null;
  const kind = rpc === "list_community_profiles"
    ? "rpcList"
    : rpc === "get_community_feature_status" ? "rpcStatus" : "rpcDetail";
  return { kind, method };
}

function validPhase(phase) {
  return phase && Number.isSafeInteger(phase.run) && phase.run > 0 && PHASES.has(phase.name);
}

function bucketKey(phase) {
  return `${phase.run}:${phase.name}`;
}

function finiteNonnegative(value) {
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

/** A recorder retains request ownership even after the active navigation changes. */
export function createCommunityAvatarRecorder(now = () => performance.now()) {
  const requests = new WeakMap();
  const buckets = new Map();

  function bucketFor(phase) {
    const key = bucketKey(phase);
    if (!buckets.has(key)) buckets.set(key, { run: phase.run, phase: phase.name, rows: [] });
    return buckets.get(key);
  }

  return {
    onRequest(request, phase) {
      const classified = classifyAvatarRequest(request.url(), request.method());
      if (!classified || !validPhase(phase)) return;
      requests.set(request, { ...classified, phase: { run: phase.run, name: phase.name }, startedAt: now() });
    },
    onResponse(response) {
      const request = response.request();
      const entry = requests.get(request);
      if (!entry) return;
      const durationMs = finiteNonnegative(now() - entry.startedAt);
      const row = {
        kind: entry.kind,
        method: entry.method,
        status: normalizeAvatarStatus(response.status()),
        durationMs,
        bodyDurationMs: null,
        objectUrlToDecodeMs: null,
        bodyBytes: null,
      };
      bucketFor(entry.phase).rows.push(row);
    },
    onRequestFailed(request) {
      const entry = requests.get(request);
      if (!entry) return;
      bucketFor(entry.phase).rows.push({
        kind: entry.kind,
        method: entry.method,
        status: "network_error",
        durationMs: finiteNonnegative(now() - entry.startedAt),
        bodyDurationMs: null,
        objectUrlToDecodeMs: null,
        bodyBytes: null,
      });
    },
    recordBrowserEvent(event) {
      if (!event || !validPhase({ run: event.run, name: event.phase })) return false;
      const allowed = {
        objectUrl: "objectUrl",
        imageDecode: "imageDecode",
        blobBody: "avatarBlobBody",
      };
      const kind = allowed[event.type];
      if (!kind) return false;
      const durationMs = finiteNonnegative(event.durationMs);
      const bodyBytes = event.type === "objectUrl" || event.type === "blobBody"
        ? finiteNonnegative(event.bodyBytes)
        : null;
      const bodyDurationMs = event.type === "blobBody" ? durationMs : null;
      const objectUrlToDecodeMs = event.type === "imageDecode"
        ? finiteNonnegative(event.objectUrlToDecodeMs)
        : null;
      bucketFor({ run: event.run, name: event.phase }).rows.push({
        kind,
        method: "OTHER",
        status: event.type === "imageDecode" || event.type === "blobBody"
          ? (event.ok === true ? "ok" : "failed")
          : "unknown",
        durationMs: event.type === "blobBody" ? null : durationMs,
        bodyDurationMs,
        objectUrlToDecodeMs,
        bodyBytes,
      });
      return true;
    },
    snapshot(phase) {
      if (!validPhase(phase)) return { route: "community", phase: "unknown", requests: [] };
      const rows = buckets.get(bucketKey(phase))?.rows || [];
      return {
        route: phase.name === "detail" ? "communityDetail" : phase.name === "leaveAndReturn" ? "outsideAndCommunity" : "communityList",
        phase: phase.name,
        requests: rows.map(({ kind, method, status, durationMs, bodyDurationMs, objectUrlToDecodeMs, bodyBytes }) => ({
          kind,
          method: normalizeAvatarMethod(method),
          status,
          durationMs,
          bodyDurationMs,
          objectUrlToDecodeMs,
          bodyBytes,
        })),
      };
    },
  };
}

/** Safe browser-side hook; it keeps Blob URLs only in a private closure map, never in report data. */
export function installAvatarBrowserMetrics() {
  if (globalThis.__gdgAvatarMetricsInstalled) return;
  globalThis.__gdgAvatarMetricsInstalled = true;
  const allowedPhases = new Set(["list", "detail", "backToList", "leaveAndReturn"]);
  const urls = new Map();
  const blobs = new WeakMap();
  const responses = new WeakMap();
  const events = [];
  let active = null;
  try {
    const stored = JSON.parse(sessionStorage.getItem("__gdgAvatarMetricsPhase") || "null");
    if (stored && Number.isSafeInteger(stored.run) && allowedPhases.has(stored.name)) {
      active = { run: stored.run, phase: stored.name };
    }
  } catch {
    active = null;
  }
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input, init) => {
    let owner = null;
    try {
      const rawUrl = typeof input === "string" ? input : input?.url;
      const url = new URL(rawUrl, location.href);
      const method = String(init?.method || input?.method || "GET").toUpperCase();
      if (/\/functions\/v1\/community-avatar$/i.test(url.pathname) && method === "GET") owner = active;
    } catch {
      owner = null;
    }
    return originalFetch(input, init).then((response) => {
      if (owner) responses.set(response, owner);
      return response;
    });
  };
  const originalBlob = Response.prototype.blob;
  Response.prototype.blob = function () {
    const owner = responses.get(this);
    if (!owner) return originalBlob.call(this);
    const startedAt = performance.now();
    return originalBlob.call(this).then((blob) => {
      blobs.set(blob, owner);
      events.push({
        type: "blobBody",
        ...owner,
        durationMs: performance.now() - startedAt,
        bodyBytes: blob.size,
        ok: true,
      });
      return blob;
    }).catch((error) => {
      events.push({
        type: "blobBody",
        ...owner,
        durationMs: performance.now() - startedAt,
        bodyBytes: null,
        ok: false,
      });
      throw error;
    });
  };
  const originalCreateObjectURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (blob) => {
    const startedAt = performance.now();
    const value = originalCreateObjectURL(blob);
    const phase = blobs.get(blob);
    if (phase && blob instanceof Blob) {
      urls.set(value, { phase, startedAt, bodyBytes: blob.size, decoded: false });
      events.push({ type: "objectUrl", ...phase, durationMs: performance.now() - startedAt, bodyBytes: blob.size });
    }
    return value;
  };
  const originalRevokeObjectURL = URL.revokeObjectURL.bind(URL);
  URL.revokeObjectURL = (value) => {
    urls.delete(value);
    return originalRevokeObjectURL(value);
  };
  document.addEventListener("load", (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;
    const item = urls.get(image.currentSrc || image.src);
    if (!item || item.decoded) return;
    item.decoded = true;
    const decodeStartedAt = performance.now();
    Promise.resolve().then(() => image.decode()).then(() => {
      events.push({
        type: "imageDecode",
        ...item.phase,
        durationMs: performance.now() - decodeStartedAt,
        objectUrlToDecodeMs: performance.now() - item.startedAt,
        ok: true,
      });
    }).catch(() => {
      events.push({
        type: "imageDecode",
        ...item.phase,
        durationMs: performance.now() - decodeStartedAt,
        objectUrlToDecodeMs: performance.now() - item.startedAt,
        ok: false,
      });
    });
  }, true);
  globalThis.__gdgAvatarMetrics = {
    setPhase(phase) {
      active = phase && Number.isSafeInteger(phase.run) && allowedPhases.has(phase.name)
        ? { run: phase.run, phase: phase.name }
        : null;
    },
    takeEvents() { return events.splice(0, events.length); },
  };
}
