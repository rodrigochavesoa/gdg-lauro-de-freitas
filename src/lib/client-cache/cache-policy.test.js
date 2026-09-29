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

  it("descarta resposta de geração antiga e remove entrada expirada", () => {
    const cache = createMemoryCache({ ttlMs: 30_000, name: "policy-epoch" });
    const epoch = cache.capture("job-1");
    cache.invalidateKey("job-1");
    expect(cache.set("job-1", { reviews: ["parecer interno"] }, epoch)).toBe(false);
    expect(cache.peek("job-1")).toBeNull();
    expect(cache.size()).toBe(0);

    cache.set("filtro-a", { jobs: [1] });
    cache.set("filtro-b", { jobs: [2] });
    expect(cache.size()).toBe(2);
    vi.advanceTimersByTime(30_001);
    expect(cache.peek("filtro-a")).toBeNull();
    expect(cache.size()).toBe(0);
  });

  it("clear não reaceita a geração capturada depois da invalidação", () => {
    const cache = createMemoryCache({ ttlMs: 30_000, name: "policy-clear-epoch" });
    const first = cache.capture("job-1");
    expect(first).toBe(0);
    cache.invalidateKey("job-1");
    const second = cache.capture("job-1");
    expect(second).toBe(1);
    cache.clear();
    expect(cache.set("job-1", { secret: "late" }, second)).toBe(false);
    expect(cache.set("job-1", { secret: "late" }, first)).toBe(false);
    expect(cache.peek("job-1")).toBeNull();
    const third = cache.capture("job-1");
    expect(third).not.toBe(first);
    expect(third).not.toBe(second);
    expect(cache.set("job-1", { secret: "fresh" }, third)).toBe(true);
    expect(cache.set("job-1", { secret: "late" }, second)).toBe(false);
    expect(cache.peek("job-1")).toEqual({ secret: "fresh" });
  });

  it("invalidateKey de chaves sem entrada nem leitura não acumula gerações", () => {
    const cache = createMemoryCache({ ttlMs: 30_000, name: "policy-invalidate-empty" });
    for (let index = 0; index < 1000; index += 1) cache.invalidateKey(`job-${index}`);
    expect(cache.epochCount()).toBe(0);

    const epoch = cache.capture("job-7");
    cache.set("job-7", { reviews: ["parecer interno"] }, epoch);
    cache.invalidateKey("job-7");
    expect(cache.epochCount()).toBe(0);
    expect(cache.set("job-7", { secret: "late" }, epoch)).toBe(false);
    expect(cache.peek("job-7")).toBeNull();

    const queued = cache.capture("pending:1:24");
    cache.set("pending:1:24", { queue: ["a"] }, queued);
    cache.invalidatePrefix("pending:");
    expect(cache.epochCount()).toBe(0);
    expect(cache.set("pending:1:24", { secret: "late" }, queued)).toBe(false);
  });

  it("descarta a geração de várias chaves expiradas que não estão em voo", () => {
    const cache = createMemoryCache({ ttlMs: 30_000, name: "policy-epoch-gc" });
    const captured = ["filtro-a", "filtro-b", "filtro-c"].map((key) => {
      const epoch = cache.capture(key);
      cache.set(key, { jobs: [key] }, epoch);
      return epoch;
    });
    const liveEpoch = cache.capture("em-voo");
    cache.set("em-voo", { jobs: ["em-voo"] }, liveEpoch);
    cache.inflightSet("em-voo", Promise.resolve());
    const catalogKey = '{"q":"react"}';
    const catalogEpoch = cache.capture(catalogKey);
    cache.set(catalogKey, { jobs: [1] }, catalogEpoch);
    cache.inflightSet(`${catalogKey}:24`, Promise.resolve());
    expect(cache.epochCount()).toBe(5);

    vi.advanceTimersByTime(30_001);
    expect(cache.peek("filtro-a")).toBeNull();
    expect(cache.epochCount()).toBe(2);
    expect(cache.set("filtro-b", { secret: "late" }, captured[1])).toBe(false);
    expect(cache.set("filtro-c", { secret: "late" }, captured[2])).toBe(false);

    cache.inflightDelete("em-voo");
    cache.inflightDelete(`${catalogKey}:24`);
    expect(cache.peek("em-voo")).toBeNull();
    expect(cache.epochCount()).toBe(0);
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
