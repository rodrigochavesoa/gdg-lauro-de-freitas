import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();

vi.mock("../../lib/supabase-client.js", () => ({
  getSupabaseBrowserClient: () => ({
    from: fromMock,
  }),
}));

import {
  CURATION_QUEUE_CACHE_TTL_MS,
  CURATION_QUEUE_PAGE_SIZE,
  invalidateCurationQueueCache,
  loadCurationJobDetail,
  loadCurationQueue,
  peekCurationQueueCache,
} from "./curation-api.js";

const PENDING_JOB = {
  id: "job-1",
  title: "Pessoa Dev Front-end",
  priority: "normal",
  created_at: "2026-09-07T12:00:00Z",
  status: "pending",
};

function delay(ms, value, onStart, onEnd) {
  return new Promise((resolve) => {
    onStart?.();
    setTimeout(() => {
      onEnd?.();
      resolve(value);
    }, ms);
  });
}

function thenable(getPromise) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    maybeSingle: vi.fn(() => getPromise()),
    then: (onFulfilled, onRejected) => getPromise().then(onFulfilled, onRejected),
  };
  return builder;
}

function mockQueueClient({
  pending = [],
  moderation = [],
  reviews = [],
  rejected = [],
  wave2Ms = 40,
} = {}) {
  const wave2 = { active: 0, max: 0, labels: [] };
  const onWave2Start = (label) => {
    wave2.labels.push(label);
    wave2.active += 1;
    wave2.max = Math.max(wave2.max, wave2.active);
  };
  const onWave2End = () => {
    wave2.active -= 1;
  };

  fromMock.mockImplementation((table) => {
    if (table === "jobs") {
      const builder = thenable(() => {
        const status = builder.eq.mock.calls.find((call) => call[0] === "status")?.[1];
        if (status === "pending") {
          return Promise.resolve({ data: pending, error: null });
        }
        return delay(wave2Ms, { data: rejected, error: null }, () => onWave2Start("rejected"), onWave2End);
      });
      return builder;
    }
    if (table === "jobs_needing_moderation") {
      return thenable(() =>
        delay(wave2Ms, { data: moderation, error: null }, () => onWave2Start("moderation"), onWave2End),
      );
    }
    if (table === "job_curation_reviews") {
      return thenable(() =>
        delay(wave2Ms, { data: reviews, error: null }, () => onWave2Start("reviews"), onWave2End),
      );
    }
    throw new Error(`tabela inesperada: ${table}`);
  });

  return wave2;
}

describe("loadCurationQueue", () => {
  beforeEach(() => {
    fromMock.mockReset();
    invalidateCurationQueueCache();
  });

  it("página pendente usa campos enxutos e só então consulta moderação dos ids da página", async () => {
    mockQueueClient({
      pending: [PENDING_JOB],
      moderation: [{ id: "job-1" }],
    });

    const result = await loadCurationQueue();

    const jobsBuilder = fromMock.mock.results.find((_, index) => fromMock.mock.calls[index][0] === "jobs")?.value;
    expect(jobsBuilder.select.mock.calls[0][0]).not.toMatch(/\bdescription\b|\bstack\b/);
    expect(jobsBuilder.order).toHaveBeenNthCalledWith(1, "priority", { ascending: false, nullsFirst: false });
    expect(jobsBuilder.range).toHaveBeenCalledWith(0, CURATION_QUEUE_PAGE_SIZE);
    expect(fromMock).toHaveBeenCalledWith("jobs_needing_moderation");
    expect(fromMock.mock.calls.some((call) => call[0] === "job_curation_reviews")).toBe(false);
    const moderationBuilder = fromMock.mock.results.find(
      (_, index) => fromMock.mock.calls[index][0] === "jobs_needing_moderation",
    )?.value;
    expect(moderationBuilder.in).toHaveBeenCalledWith("id", ["job-1"]);
    expect(result.queue).toHaveLength(1);
    expect(result.queue[0].needsModeration).toBe(true);
    expect(result.rejected).toEqual([]);
    expect(result.hasNext).toBe(false);
  });

  it("não consulta moderação, rejeitadas nem pareceres quando a página pendente vem vazia", async () => {
    mockQueueClient({ pending: [] });

    const result = await loadCurationQueue();

    expect(fromMock).toHaveBeenCalledWith("jobs");
    expect(fromMock).not.toHaveBeenCalledWith("jobs_needing_moderation");
    expect(fromMock.mock.calls.some((call) => call[0] === "job_curation_reviews")).toBe(false);
    expect(fromMock.mock.calls.filter((call) => call[0] === "jobs")).toHaveLength(1);
    expect(result.queue).toEqual([]);
    expect(result.rejected).toEqual([]);
    expect(result.hasNext).toBe(false);
  });

  it("rejeitadas paginam sem moderação e sem pareceres", async () => {
    mockQueueClient({
      rejected: [{ id: "job-r", status: "rejected", title: "Rejeitada", created_at: "2026-09-01T00:00:00Z" }],
    });

    const result = await loadCurationQueue({ scope: "rejected" });

    expect(fromMock).not.toHaveBeenCalledWith("jobs_needing_moderation");
    expect(fromMock.mock.calls.some((call) => call[0] === "job_curation_reviews")).toBe(false);
    expect(fromMock.mock.calls.filter((call) => call[0] === "jobs")).toHaveLength(1);
    const jobsBuilder = fromMock.mock.results[0].value;
    expect(jobsBuilder.eq).toHaveBeenCalledWith("status", "rejected");
    expect(result.rejected).toHaveLength(1);
    expect(result.queue).toEqual([]);
  });

  it("sinaliza próxima página quando a consulta devolve um item além do limite", async () => {
    const pending = Array.from({ length: CURATION_QUEUE_PAGE_SIZE + 1 }, (_, index) => ({
      ...PENDING_JOB,
      id: `job-${index}`,
    }));
    mockQueueClient({ pending });

    const result = await loadCurationQueue();

    expect(result.queue).toHaveLength(CURATION_QUEUE_PAGE_SIZE);
    expect(result.hasNext).toBe(true);
    const moderationBuilder = fromMock.mock.results.find(
      (_, index) => fromMock.mock.calls[index][0] === "jobs_needing_moderation",
    )?.value;
    expect(moderationBuilder.in.mock.calls[0][1]).toHaveLength(CURATION_QUEUE_PAGE_SIZE);
  });

  it("reusa o cache na segunda chamada dentro do TTL", async () => {
    mockQueueClient({ pending: [PENDING_JOB] });
    const first = await loadCurationQueue();
    const second = await loadCurationQueue();
    expect(second).toBe(first);
    expect(peekCurationQueueCache()).toBe(first);
    expect(fromMock.mock.calls.filter((call) => call[0] === "jobs")).toHaveLength(1);
  });

  it("ignora o cache quando forceRefresh é true", async () => {
    mockQueueClient({ pending: [PENDING_JOB] });
    await loadCurationQueue();
    mockQueueClient({ pending: [PENDING_JOB] });
    await loadCurationQueue({ forceRefresh: true });
    expect(fromMock.mock.calls.filter((call) => call[0] === "jobs")).toHaveLength(2);
  });

  it("deduplica fetches concorrentes enquanto o primeiro está em voo", async () => {
    let resolvePending;
    const pendingPromise = new Promise((resolve) => {
      resolvePending = () => resolve({ data: [PENDING_JOB], error: null });
    });
    fromMock.mockImplementation((table) => {
      if (table === "jobs") {
        return thenable(() => pendingPromise);
      }
      if (table === "jobs_needing_moderation") {
        return thenable(() => Promise.resolve({ data: [], error: null }));
      }
      throw new Error(`tabela inesperada: ${table}`);
    });

    const first = loadCurationQueue();
    const second = loadCurationQueue();
    expect(fromMock.mock.calls.filter((call) => call[0] === "jobs")).toHaveLength(1);
    resolvePending();
    const [a, b] = await Promise.all([first, second]);
    expect(a).toBe(b);
    expect(a.queue).toHaveLength(1);
  });

  it("expira o peek depois do TTL", async () => {
    mockQueueClient({ pending: [PENDING_JOB], wave2Ms: 0 });
    await loadCurationQueue();
    expect(peekCurationQueueCache()).not.toBeNull();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(Date.now() + CURATION_QUEUE_CACHE_TTL_MS + 1);
    expect(peekCurationQueueCache()).toBeNull();
    nowSpy.mockRestore();
  });
});

describe("loadCurationJobDetail", () => {
  beforeEach(() => {
    fromMock.mockReset();
    invalidateCurationQueueCache();
  });

  it("busca descrição, stack e pareceres só da vaga aberta", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "jobs") {
        const eq = vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: { id: "job-1", description: "Texto", stack: ["React"] },
            error: null,
          })),
        }));
        const select = vi.fn(() => ({ eq }));
        return { select };
      }
      if (table === "job_curation_reviews") {
        const order = vi.fn(async () => ({
          data: [{ job_id: "job-1", decision: "approve", created_at: "2026-09-07T12:00:00Z" }],
          error: null,
        }));
        const eq = vi.fn(() => ({ order }));
        const select = vi.fn(() => ({ eq }));
        return { select };
      }
      throw new Error(`tabela inesperada: ${table}`);
    });

    const detail = await loadCurationJobDetail("job-1");
    const jobsSelect = fromMock.mock.results[0].value.select.mock.calls[0][0];
    expect(jobsSelect).toMatch(/description/);
    expect(jobsSelect).toMatch(/stack/);
    expect(fromMock.mock.results[1].value.select.mock.results[0].value.eq).toHaveBeenCalledWith("job_id", "job-1");
    expect(detail.description).toBe("Texto");
    expect(detail.reviews).toHaveLength(1);

    await loadCurationJobDetail("job-1");
    expect(fromMock.mock.calls.filter((call) => call[0] === "jobs")).toHaveLength(1);
  });
});
