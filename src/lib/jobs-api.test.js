import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();

vi.mock("./supabase-client.js", () => ({
  getSupabaseBrowserClient: () => ({
    from: fromMock,
  }),
}));

import {
  buildCatalogSearchOr,
  buildSalaryVisibilityOr,
  catalogCountryCode,
  CATALOG_CACHE_TTL_MS,
  CATALOG_PAGE_SIZE,
  findApprovedJobInCache,
  invalidateApprovedJobsCache,
  JOB_DETAIL_HEAVY_SELECT,
  loadApprovedJob,
  loadApprovedJobs,
  mergeJobDetailRows,
} from "./jobs-api.js";

const SAMPLE_ROW = {
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
};

function mockCatalogQuery({ data = [SAMPLE_ROW], count = data.length, error = null, pending } = {}) {
  const builder = {};
  const methods = ["select", "eq", "overlaps", "in", "or", "filter", "ilike", "order", "range"];
  for (const name of methods) {
    builder[name] = vi.fn(() => {
      if (name === "range") {
        if (pending) {
          return new Promise((resolve) => {
            pending.resolveRange = () => resolve({ data, error, count });
          });
        }
        return Promise.resolve({ data, error, count });
      }
      return builder;
    });
  }
  fromMock.mockReturnValue(builder);
  return builder;
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

  it("pede status approved, pagina 24, count exact e ordem estável", async () => {
    const builder = mockCatalogQuery();

    const page = await loadApprovedJobs();

    expect(fromMock).toHaveBeenCalledWith("jobs");
    expect(builder.select).toHaveBeenCalledWith(expect.stringContaining("title"), { count: "exact" });
    expect(builder.select.mock.calls[0][0]).toMatch(/country_code/);
    expect(builder.select.mock.calls[0][0]).toMatch(/salary_min/);
    expect(builder.select.mock.calls[0][0]).toMatch(/salary_currency/);
    expect(builder.select.mock.calls[0][0]).not.toMatch(/description/);
    expect(builder.select.mock.calls[0][0]).not.toMatch(/requirements/);
    expect(builder.eq).toHaveBeenCalledWith("status", "approved");
    expect(builder.order).toHaveBeenNthCalledWith(1, "approved_at", { ascending: false });
    expect(builder.order).toHaveBeenNthCalledWith(2, "id", { ascending: false });
    expect(builder.range).toHaveBeenCalledWith(0, CATALOG_PAGE_SIZE - 1);
    expect(page.jobs).toHaveLength(1);
    expect(page.count).toBe(1);
    expect(page.jobs[0].title).toBe("Pessoa Desenvolvedora Front-end");
    expect(page.jobs[0].level).toBe("Pleno");
  });

  it("ordena antiga com approved_at e id ascendentes", async () => {
    const builder = mockCatalogQuery();
    await loadApprovedJobs({ sort: "oldest" });
    expect(builder.order).toHaveBeenNthCalledWith(1, "approved_at", { ascending: true });
    expect(builder.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
  });

  it("envia busca e filtros na query PostgREST, não só no array", async () => {
    const builder = mockCatalogQuery({ data: [], count: 0 });
    await loadApprovedJobs({
      query: "Nuvem",
      tech: ["React"],
      level: ["Pleno"],
      workModel: ["Remoto"],
    });

    expect(builder.select.mock.calls[0][0]).toMatch(/co:companies\(\)/);
    expect(builder.filter).toHaveBeenCalledWith("co.name", "ilike", "%Nuvem%");
    expect(builder.overlaps).toHaveBeenCalledWith("stack", ["React"]);
    expect(builder.in).toHaveBeenCalledWith("level", ["mid"]);
    expect(builder.in).toHaveBeenCalledWith("work_model", ["remote"]);
    expect(builder.or).toHaveBeenCalledWith(expect.stringContaining("title.ilike."));
    expect(builder.or).toHaveBeenCalledWith(expect.stringContaining("co.not.is.null"));
    expect(builder.or.mock.calls[0][0]).toMatch(/stack\.ov\./);
  });

  it("filtra país, localidade e faixa no PostgREST e mantém ordem e página", async () => {
    const builder = mockCatalogQuery({ data: [], count: 0 });
    await loadApprovedJobs({
      country: "br",
      place: "Salvador",
      salaryMin: 800000,
      salaryMax: 1200000,
    });

    expect(builder.eq).toHaveBeenCalledWith("status", "approved");
    expect(builder.eq).toHaveBeenCalledWith("country_code", "BR");
    expect(builder.or).not.toHaveBeenCalledWith(expect.stringContaining("country_code.is.null"));
    expect(builder.or).toHaveBeenCalledWith(
      "and(or(salary_min.not.is.null,salary_max.not.is.null),or(salary_min.is.null,salary_min.lte.1200000),or(salary_max.is.null,salary_max.gte.800000))",
    );
    expect(builder.ilike).toHaveBeenCalledWith("location", "%Salvador%");
    expect(builder.order).toHaveBeenNthCalledWith(1, "approved_at", { ascending: false });
    expect(builder.order).toHaveBeenNthCalledWith(2, "id", { ascending: false });
    expect(builder.range).toHaveBeenCalledWith(0, CATALOG_PAGE_SIZE - 1);
  });

  it("ignora país inválido e faixa invertida sem segundo or", async () => {
    const builder = mockCatalogQuery({ data: [], count: 0 });
    await loadApprovedJobs({ country: "brasil", salaryMin: 20, salaryMax: 1, place: "  " });
    expect(builder.or).not.toHaveBeenCalled();
    expect(builder.ilike).not.toHaveBeenCalled();
  });

  it("não reusa cache quando país ou salário mudam", async () => {
    mockCatalogQuery();
    await loadApprovedJobs();
    mockCatalogQuery({ data: [], count: 0 });
    await loadApprovedJobs({ country: "BR" });
    mockCatalogQuery({ data: [], count: 0 });
    await loadApprovedJobs({ country: "BR", salaryMin: 100 });
    expect(fromMock).toHaveBeenCalledTimes(3);
  });

  it("registra a busca sem a query do catálogo", async () => {
    vi.stubEnv("VITE_OPS_EMIT", "true");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      mockCatalogQuery({ data: [], count: 0 });
      await loadApprovedJobs({ query: "Nuvem pessoa@example.com", tech: ["React"] });
      await loadApprovedJobs({ query: "Nuvem pessoa@example.com", tech: ["React"] });
      const events = info.mock.calls.map((call) => call[0]).filter((entry) => entry?.event_name === "ops.search");
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        event_name: "ops.search",
        action: "catalog_search",
        route: "/vagas",
        outcome: "success",
        error_class: "none",
        environment: "ci",
      });
      expect(JSON.stringify(events)).not.toMatch(/Nuvem|pessoa@example.com|React/);
    } finally {
      info.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it("mapeia Sênior para senior e lead", async () => {
    const builder = mockCatalogQuery({ data: [], count: 0 });
    await loadApprovedJobs({ level: ["Sênior"] });
    expect(builder.in).toHaveBeenCalledWith("level", ["senior", "lead"]);
  });

  it("reusa o cache na segunda chamada dentro do TTL", async () => {
    mockCatalogQuery();

    const first = await loadApprovedJobs();
    const second = await loadApprovedJobs();

    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(second.jobs).toBe(first.jobs);
    expect(second.count).toBe(first.count);
  });

  it("não reusa cache de outro conjunto de filtros", async () => {
    mockCatalogQuery();
    await loadApprovedJobs();
    mockCatalogQuery({ data: [], count: 0 });
    await loadApprovedJobs({ query: "Python" });
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it("refaz o fetch depois que o TTL expira", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T00:00:00.000Z"));
    mockCatalogQuery();

    await loadApprovedJobs();
    expect(fromMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-09-08T00:00:00.000Z").getTime() + CATALOG_CACHE_TTL_MS + 1);
    mockCatalogQuery();
    await loadApprovedJobs();

    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it("ignora o cache quando forceRefresh é true", async () => {
    mockCatalogQuery();
    await loadApprovedJobs();
    mockCatalogQuery();
    await loadApprovedJobs({ forceRefresh: true });
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it("deduplica fetches concorrentes enquanto o primeiro está em voo", async () => {
    const pending = {};
    mockCatalogQuery({ pending });

    const first = loadApprovedJobs();
    const second = loadApprovedJobs();
    expect(fromMock).toHaveBeenCalledTimes(1);
    pending.resolveRange();
    const [a, b] = await Promise.all([first, second]);
    expect(a.jobs).toBe(b.jobs);
    expect(a.jobs).toHaveLength(1);
  });

  it("append de carregar mais acumula páginas já carregadas", async () => {
    const firstRow = { ...SAMPLE_ROW, id: "1" };
    const secondRow = { ...SAMPLE_ROW, id: "2", title: "Outra vaga" };
    mockCatalogQuery({ data: [firstRow], count: 25 });
    const first = await loadApprovedJobs();
    expect(first.jobs).toHaveLength(1);

    const builder = mockCatalogQuery({ data: [secondRow], count: 25 });
    const appended = await loadApprovedJobs({ offset: 24 });
    expect(builder.range).toHaveBeenCalledWith(24, 24 + CATALOG_PAGE_SIZE - 1);
    expect(appended.jobs.map((job) => job.id)).toEqual(["1", "2"]);
    expect(appended.count).toBe(25);
    expect(findApprovedJobInCache("2")?.title).toBe("Outra vaga");
  });

  it("findApprovedJobInCache devolve o job parcial da lista e null fora do cache", async () => {
    mockCatalogQuery();
    await loadApprovedJobs();
    expect(findApprovedJobInCache("1")?.title).toBe("Pessoa Desenvolvedora Front-end");
    expect(findApprovedJobInCache("1")?.description).toBeUndefined();
    expect(findApprovedJobInCache("missing")).toBeNull();
    invalidateApprovedJobsCache();
    expect(findApprovedJobInCache("1")).toBeNull();
  });
});

describe("vagas legadas com filtro ativo", () => {
  it("sem país nem faixa não envia predicado estruturado", async () => {
    invalidateApprovedJobsCache();
    const builder = mockCatalogQuery({ data: [], count: 0 });
    await loadApprovedJobs();
    expect(builder.eq).not.toHaveBeenCalledWith("country_code", expect.anything());
    expect(builder.or).not.toHaveBeenCalled();
    expect(catalogCountryCode("")).toBeNull();
    expect(buildSalaryVisibilityOr(null, null)).toBeNull();
  });

  it("com país exige country_code e não trata null como correspondente", () => {
    expect(catalogCountryCode("br")).toBe("BR");
    expect(catalogCountryCode("br")).not.toMatch(/null/);
    const clause = buildSalaryVisibilityOr(null, null);
    expect(clause).toBeNull();
  });

  it("com faixa exige dado salarial e não trata A combinar como interseção", () => {
    const both = buildSalaryVisibilityOr(800000, 1200000);
    expect(both).toContain("salary_min.not.is.null");
    expect(both).toContain("salary_max.not.is.null");
    expect(both).not.toMatch(/salary_min\.is\.null,salary_max\.is\.null/);
    expect(buildSalaryVisibilityOr(500000, null)).toBe(
      "and(or(salary_min.not.is.null,salary_max.not.is.null),or(salary_max.is.null,salary_max.gte.500000))",
    );
    expect(buildSalaryVisibilityOr(null, 700000)).toBe(
      "and(or(salary_min.not.is.null,salary_max.not.is.null),or(salary_min.is.null,salary_min.lte.700000))",
    );
    expect(buildSalaryVisibilityOr(20, 10)).toBeNull();
  });
});

describe("buildCatalogSearchOr", () => {
  it("busca título, stack e empresa (co.not.is.null) na mesma cláusula or", () => {
    const clause = buildCatalogSearchOr("React");
    expect(clause).toContain("title.ilike.");
    expect(clause).toContain("co.not.is.null");
    expect(clause).toContain("stack.ov.");
    expect(clause).toContain("React");
  });

  it("escapa % e aspas do termo", () => {
    const clause = buildCatalogSearchOr('100% "x"');
    expect(clause).toContain("\\%");
    expect(clause).not.toMatch(/title\.ilike\.%100%/);
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
    mockCatalogQuery();
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
    mockCatalogQuery();
    await loadApprovedJobs();
    fromMock.mockReset();
    mockDetailChain({ data: null });
    expect(await loadApprovedJob("1")).toBeNull();
  });
});
