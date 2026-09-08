import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();

vi.mock("./supabase-client.js", () => ({
  getSupabaseBrowserClient: () => ({
    from: fromMock,
  }),
}));

import {
  CATALOG_CACHE_TTL_MS,
  invalidateApprovedJobsCache,
  loadApprovedJobs,
} from "./jobs-api.js";

function mockApprovedQuery() {
  const order = vi.fn().mockResolvedValue({
    data: [
      {
        id: "1",
        title: "Pessoa Desenvolvedora Front-end",
        description: "Fictícia",
        requirements: { mandatory: ["Testar"] },
        stack: ["React"],
        level: "mid",
        work_model: "remote",
        location: "Brasil",
        status: "approved",
        approved_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        companies: { name: "Nuvem Lauro Demo", description: "Demo" },
      },
    ],
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  fromMock.mockReturnValue({ select });
  return { order, eq, select };
}

describe("loadApprovedJobs", () => {
  beforeEach(() => {
    fromMock.mockReset();
    invalidateApprovedJobsCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pede apenas status approved e mapeia as linhas", async () => {
    const { eq, select } = mockApprovedQuery();

    const jobs = await loadApprovedJobs();

    expect(fromMock).toHaveBeenCalledWith("jobs");
    expect(eq).toHaveBeenCalledWith("status", "approved");
    expect(select.mock.calls[0][0]).not.toMatch(/description/);
    expect(select.mock.calls[0][0]).not.toMatch(/requirements/);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("Pessoa Desenvolvedora Front-end");
    expect(jobs[0].level).toBe("Pleno");
  });

  it("reusa o cache na segunda chamada dentro do TTL", async () => {
    mockApprovedQuery();

    const first = await loadApprovedJobs();
    const second = await loadApprovedJobs();

    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it("refaz o fetch depois que o TTL expira", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T00:00:00.000Z"));
    mockApprovedQuery();

    await loadApprovedJobs();
    expect(fromMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-09-08T00:00:00.000Z").getTime() + CATALOG_CACHE_TTL_MS + 1);
    mockApprovedQuery();
    await loadApprovedJobs();

    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it("ignora o cache quando forceRefresh é true", async () => {
    mockApprovedQuery();
    await loadApprovedJobs();
    mockApprovedQuery();
    await loadApprovedJobs({ forceRefresh: true });
    expect(fromMock).toHaveBeenCalledTimes(2);
  });
});
