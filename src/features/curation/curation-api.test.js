import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();

vi.mock("../../lib/supabase-client.js", () => ({
  getSupabaseBrowserClient: () => ({
    from: fromMock,
  }),
}));

import { loadCurationQueue } from "./curation-api.js";

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
  });

  it("busca pending e depois moderation, reviews filtrados e rejected em paralelo", async () => {
    const promiseAll = vi.spyOn(Promise, "all");
    const wave2 = mockQueueClient({
      pending: [PENDING_JOB],
      moderation: [{ id: "job-1" }],
      reviews: [{ job_id: "job-1", curation_round: 1, decision: "approve" }],
      rejected: [{ id: "job-r", status: "rejected", title: "Rejeitada" }],
    });

    const result = await loadCurationQueue({ includeRejected: true });

    expect(promiseAll).toHaveBeenCalledTimes(1);
    expect(promiseAll.mock.calls[0][0]).toHaveLength(3);
    expect(wave2.max).toBe(3);
    expect(wave2.labels.sort()).toEqual(["moderation", "rejected", "reviews"]);

    const reviewsBuilder = fromMock.mock.results.find((_, index) => fromMock.mock.calls[index][0] === "job_curation_reviews")
      ?.value;
    expect(reviewsBuilder.in).toHaveBeenCalledWith("job_id", ["job-1"]);
    expect(result.queue).toHaveLength(1);
    expect(result.queue[0].needsModeration).toBe(true);
    expect(result.rejected).toHaveLength(1);
    expect(result.reviews).toHaveLength(1);

    promiseAll.mockRestore();
  });

  it("não busca rejected nem a tabela inteira de reviews quando a fila está vazia e o caller não é admin", async () => {
    const wave2 = mockQueueClient({ pending: [] });

    const result = await loadCurationQueue({ includeRejected: false });

    expect(fromMock).toHaveBeenCalledWith("jobs");
    expect(fromMock).toHaveBeenCalledWith("jobs_needing_moderation");
    expect(fromMock.mock.calls.some((call) => call[0] === "job_curation_reviews")).toBe(false);
    expect(fromMock.mock.calls.filter((call) => call[0] === "jobs")).toHaveLength(1);
    expect(wave2.labels).toEqual(["moderation"]);
    expect(result.queue).toEqual([]);
    expect(result.rejected).toEqual([]);
    expect(result.reviews).toEqual([]);
  });
});
