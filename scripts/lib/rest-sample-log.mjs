/**
 * Correlaciona REST pelo objeto Request.
 * responseAt = headers recebidos. finishedAt = requestfinished (corpo baixado).
 */
export function createRestSampleLog() {
  const entries = [];
  const byRequest = new Map();

  function entryFor(request) {
    return byRequest.get(request) ?? null;
  }

  return {
    get entries() {
      return entries;
    },
    entryFor,
    onRequest(request, path, at) {
      if (!path || !request) return null;
      const entry = {
        request,
        path,
        at,
        responseAt: null,
        finishedAt: null,
        status: null,
        bytes: null,
        failed: false,
      };
      entries.push(entry);
      byRequest.set(request, entry);
      return entry;
    },
    onResponse(request, { status = null, at = null, headerBytes = null } = {}) {
      const entry = entryFor(request);
      if (!entry) return null;
      entry.status = status;
      entry.responseAt = at;
      if (Number.isFinite(headerBytes) && headerBytes > 0) entry.bytes = headerBytes;
      return entry;
    },
    onFinished(request, { at = null, bodyBytes = null } = {}) {
      const entry = entryFor(request);
      if (!entry) return null;
      entry.finishedAt = at;
      if (Number.isFinite(bodyBytes) && bodyBytes >= 0) entry.bytes = bodyBytes;
      return entry;
    },
    onFailed(request, at) {
      const entry = entryFor(request);
      if (!entry) return null;
      entry.failed = true;
      entry.finishedAt = at;
      return entry;
    },
    inflightRequests() {
      return entries.filter((entry) => entry.finishedAt == null).map((entry) => entry.request);
    },
  };
}

export function restCallRecord(row) {
  return {
    path: row.path,
    status: row.status,
    bytes: row.bytes ?? null,
  };
}

export function restTimingRecord(row, clickAt) {
  return {
    path: row.path,
    status: row.status,
    bytes: row.bytes ?? null,
    startOffsetMs: clickAt == null ? null : row.at - clickAt,
    responseOffsetMs: clickAt == null || row.responseAt == null ? null : row.responseAt - clickAt,
    endOffsetMs: clickAt == null || row.finishedAt == null ? null : row.finishedAt - clickAt,
  };
}

export function carriedTimingFor(log, inflightRequests, clickAt) {
  return [...inflightRequests].flatMap((request) => {
    const entry = log.entryFor(request);
    if (!entry) return [];
    return [restTimingRecord(entry, clickAt)];
  });
}
