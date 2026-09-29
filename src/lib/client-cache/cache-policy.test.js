import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryCache } from "./store.js";
import { getClientCacheStats, resetClientCacheStats } from "./stats.js";

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("../supabase-client.js", () => ({
  getSupabaseBrowserClient: () => ({
    from: fromMock,
    rpc: rpcMock,
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } }, error: null })) },
  }),
}));

import { invalidateApprovedJobsCache, loadApprovedJobs, peekApprovedJobsCache } from "../jobs-api.js";
import { invalidateSessionCaches } from "./session.js";
import { loadMyApplications, peekMyApplicationsCache } from "../../features/jobs/apply-api.js";
import { loadPrivacyPreferences, peekPrivacyPreferencesCache } from "../../features/privacy/privacy-api.js";
import { submitCurationReview } from "../../features/curation/curation-api.js";
import { updatePendingJob } from "../admin-api.js";

function chain(result) {
  const builder = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
        }
        return () => builder;
      },
    },
  );
  return builder;
}

const CATALOG_ROW = {
  id: "1",
  title: "Pessoa Desenvolvedora Front-end",
  status: "approved",
  stack: ["React"],
  level: "mid",
  work_model: "remote",
  location: "Brasil",
  approved_at: "2026-09-07T12:00:00Z",
  created_at: "2026-09-07T12:00:00Z",
  companies: { name: "Nuvem Lauro Demo" },
};

function applicationRow(id, candidateId) {
  return {
    id,
    job_id: `job-${id}`,
    candidate_id: candidateId,
    status: "submitted",
    jobs: { title: "Pessoa Dev", companies: { name: "Nuvem Lauro Demo" } },
  };
}

describe("createMemoryCache", () => {
  beforeEach(() => {
    resetClientCacheStats();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("conta hit e miss e invalida por prefixo", () => {
    const cache = createMemoryCache({ ttlMs: 30_000, name: "policy-probe" });
    expect(cache.peek("pending:1:24")).toBeNull();
    cache.set("pending:1:24", { queue: ["a"] });
    cache.set("rejected:1:24", { queue: ["b"] });
    cache.set("other-job", { description: "fica" });
    expect(cache.peek("pending:1:24")).toEqual({ queue: ["a"] });
    cache.invalidatePrefix("pending:");
    expect(cache.peek("pending:1:24")).toBeNull();
    expect(cache.peek("rejected:1:24")).toEqual({ queue: ["b"] });
    expect(cache.peek("other-job")).toEqual({ description: "fica" });
    vi.advanceTimersByTime(30_001);
    expect(cache.peek("rejected:1:24")).toBeNull();
    expect(getClientCacheStats()["policy-probe"]).toEqual({ hit: 3, miss: 3 });
  });
});

describe("caches de sessão", () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
    invalidateSessionCaches();
    invalidateApprovedJobsCache();
  });

  it("troca de usuário e logout não reexpõem candidaturas nem privacidade", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "applications") {
        return {
          select: () => ({
            eq: (_column, candidateId) =>
              chain({
                data: [applicationRow(candidateId, candidateId)],
                error: null,
              }),
          }),
        };
      }
      if (table === "privacy_purposes") {
        return chain({
          data: [{ purpose_code: "F-01", version: 1, title: "Conta" }],
          error: null,
        });
      }
      if (table === "privacy_consent_events") {
        return chain({ data: [], error: null });
      }
      throw new Error(`tabela inesperada: ${table}`);
    });

    await loadMyApplications("user-a");
    await loadMyApplications("user-b");
    await loadPrivacyPreferences("user-a");
    await loadPrivacyPreferences("user-b");
    expect(peekMyApplicationsCache("user-a")?.applications[0].candidateId).toBe("user-a");
    expect(peekPrivacyPreferencesCache("user-a")?.source).toBe("supabase");

    invalidateSessionCaches("user-a");
    expect(peekMyApplicationsCache("user-a")).toBeNull();
    expect(peekPrivacyPreferencesCache("user-a")).toBeNull();
    expect(peekMyApplicationsCache("user-b")?.applications[0].candidateId).toBe("user-b");
    expect(peekPrivacyPreferencesCache("user-b")?.source).toBe("supabase");

    invalidateSessionCaches();
    expect(peekMyApplicationsCache("user-b")).toBeNull();
    expect(peekPrivacyPreferencesCache("user-b")).toBeNull();
  });

  it("aprovação de curadoria e update de vaga aprovada invalidam o catálogo", async () => {
    fromMock.mockImplementation((table) => {
      if (table !== "jobs") throw new Error(table);
      return { select: () => chain({ data: [CATALOG_ROW], error: null, count: 1 }) };
    });
    await loadApprovedJobs();
    expect(peekApprovedJobsCache()).toHaveLength(1);

    rpcMock.mockResolvedValue({ data: { id: "1" }, error: null });
    await submitCurationReview({
      jobId: "1",
      decision: "approve",
      rubricCode: "R1-empresa-identificavel",
    });
    expect(peekApprovedJobsCache()).toBeNull();

    await loadApprovedJobs();
    expect(peekApprovedJobsCache()).toHaveLength(1);
    fromMock.mockImplementation(() => {
      const probe = { data: [], error: null };
      const updated = { data: { id: "1", title: "Pessoa Dev", status: "approved" }, error: null };
      const builder = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === "then") return (resolve, reject) => Promise.resolve(probe).then(resolve, reject);
            if (prop === "single") return () => Promise.resolve(updated);
            return () => builder;
          },
        },
      );
      return { select: () => builder, update: () => builder };
    });
    await updatePendingJob("1", {
      title: "Pessoa Dev",
      description: "Vaga fictícia de teste.",
      companyId: "a1a1a1a1-0001-4000-8000-000000000001",
      level: "Pleno",
      workModel: "Remoto",
    });
    expect(peekApprovedJobsCache()).toBeNull();
  });
});
