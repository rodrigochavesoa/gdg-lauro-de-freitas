import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();

vi.mock("./supabase-client.js", () => ({
  getSupabaseBrowserClient: () => ({
    from: fromMock,
  }),
}));

import {
  CATALOG_CACHE_TTL_MS,
  findApprovedJobInCache,
  invalidateApprovedJobsCache,
  JOB_DETAIL_HEAVY_SELECT,
  loadApprovedJob,
  loadApprovedJobs,
  mergeJobDetailRows,
} from "./jobs-api.js";

function mockApprovedQuery() {
  const order = vi.fn().mockResolvedValue({
    data: [
      {
        id: "1",
        title: "Pessoa Desenvolvedora Front-end",
        stack: ["React"],
        level: "mid",
        work_model: "remote",
        location: "Brasil",
        status: "approved",
        approved_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        companies: { name: "Nuvem Lauro Demo" },
      },
    ],
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  fromMock.mockReturnValue({ select });
  return { order, eq, select };
}

function mockDetailChain({ data, selectCapture }) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const eqId = vi.fn().mockReturnValue({ maybeSingle });
  const eqStatus = vi.fn().mockReturnValue({ eq: eqId });
  const select = vi.fn().mockImplementation((cols) => {
    selectCapture?.(cols);
    return { eq: eqStatus };
  });
  fromMock.mockReturnValue({ select });
  return { select, eqStatus, eqId, maybeSingle };
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

  it("deduplica fetches concorrentes enquanto o primeiro está em voo", async () => {
    let resolveOrder;
    const order = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveOrder = () =>
            resolve({
              data: [
                {
                  id: "1",
                  title: "Pessoa Desenvolvedora Front-end",
                  stack: ["React"],
                  level: "mid",
                  work_model: "remote",
                  location: "Brasil",
                  status: "approved",
                  approved_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                  companies: { name: "Nuvem Lauro Demo" },
                },
              ],
              error: null,
            });
        }),
    );
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select });

    const first = loadApprovedJobs();
    const second = loadApprovedJobs();
    expect(fromMock).toHaveBeenCalledTimes(1);
    resolveOrder();
    const [a, b] = await Promise.all([first, second]);
    expect(a).toBe(b);
    expect(a).toHaveLength(1);
  });

  it("findApprovedJobInCache devolve o job parcial da lista e null fora do cache", async () => {
    mockApprovedQuery();
    await loadApprovedJobs();
    expect(findApprovedJobInCache("1")?.title).toBe("Pessoa Desenvolvedora Front-end");
    expect(findApprovedJobInCache("1")?.description).toBeUndefined();
    expect(findApprovedJobInCache("missing")).toBeNull();
    invalidateApprovedJobsCache();
    expect(findApprovedJobInCache("1")).toBeNull();
  });
});

describe("mergeJobDetailRows", () => {
  it("mescla description, requirements e companies.description sem inventar título", () => {
    const listRow = {
      id: "1",
      title: "Pessoa Desenvolvedora Front-end",
      companies: { name: "Nuvem Lauro Demo" },
    };
    const heavy = {
      id: "1",
      description: "Detalhe",
      requirements: { mandatory: ["React"] },
      companies: { description: "Sobre a empresa" },
    };
    expect(mergeJobDetailRows(listRow, heavy)).toEqual({
      id: "1",
      title: "Pessoa Desenvolvedora Front-end",
      description: "Detalhe",
      requirements: { mandatory: ["React"] },
      companies: { name: "Nuvem Lauro Demo", description: "Sobre a empresa" },
    });
  });
});

describe("loadApprovedJob", () => {
  beforeEach(() => {
    fromMock.mockReset();
    invalidateApprovedJobsCache();
  });

  it("cache hit usa só JOB_DETAIL_HEAVY_SELECT e faz merge", async () => {
    mockApprovedQuery();
    await loadApprovedJobs();
    fromMock.mockReset();

    const selects = [];
    mockDetailChain({
      selectCapture: (cols) => selects.push(cols),
      data: {
        id: "1",
        description: "Buscamos uma pessoa apaixonada",
        requirements: { mandatory: ["Construir interfaces"] },
        companies: { description: "Empresa fictícia" },
      },
    });

    const job = await loadApprovedJob("1");

    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(selects[0]).toBe(JOB_DETAIL_HEAVY_SELECT);
    expect(selects[0]).not.toMatch(/title/);
    expect(selects[0]).not.toMatch(/stack/);
    expect(job.title).toBe("Pessoa Desenvolvedora Front-end");
    expect(job.company).toBe("Nuvem Lauro Demo");
    expect(job.description).toBe("Buscamos uma pessoa apaixonada");
    expect(job.about).toBe("Empresa fictícia");
    expect(job.responsibilities).toEqual(["Construir interfaces"]);
  });

  it("cache miss usa SELECT completo com title e description", async () => {
    const selects = [];
    mockDetailChain({
      selectCapture: (cols) => selects.push(cols),
      data: {
        id: "9",
        title: "Deep Link Job",
        description: "Texto completo",
        requirements: { mandatory: ["API"] },
        stack: ["Node.js"],
        level: "junior",
        work_model: "remote",
        location: "Brasil",
        status: "approved",
        approved_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        companies: { name: "Baía Code", description: "Sobre" },
      },
    });

    const job = await loadApprovedJob("9");

    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(selects[0]).toMatch(/title/);
    expect(selects[0]).toMatch(/description/);
    expect(selects[0]).toMatch(/stack/);
    expect(job.title).toBe("Deep Link Job");
    expect(job.description).toBe("Texto completo");
    expect(job.about).toBe("Sobre");
  });

  it("cache hit sem heavy row devolve null", async () => {
    mockApprovedQuery();
    await loadApprovedJobs();
    fromMock.mockReset();
    mockDetailChain({ data: null });
    expect(await loadApprovedJob("1")).toBeNull();
  });
});
