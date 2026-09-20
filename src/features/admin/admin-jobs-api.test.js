import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();

vi.mock("../../lib/supabase-client.js", () => ({
  getSupabaseBrowserClient: () => ({
    from: fromMock,
  }),
}));

import {
  ADMIN_JOB_PAGE_SIZE,
  ADMIN_JOB_SORT_OLDEST,
  ADMIN_JOB_SORT_RECENT,
  adminJobListSearchParams,
  loadAdminJobPage,
  parseAdminJobListSearch,
} from "./admin-jobs-api.js";

const SAMPLE_ROW = {
  id: "j1",
  title: "Pessoa Estagiária (rascunho)",
  status: "pending",
  created_at: "2026-09-18T12:00:00.000Z",
  level: "intern",
  work_model: "remote",
  companies: { name: "Nuvem Lauro Demo" },
};

function mockListQuery({ data = [SAMPLE_ROW], count = data.length, error = null } = {}) {
  const builder = {};
  const methods = ["select", "eq", "or", "filter", "order", "range"];
  for (const name of methods) {
    builder[name] = vi.fn(() => {
      if (name === "range") {
        return Promise.resolve({ data, error, count });
      }
      return builder;
    });
  }
  fromMock.mockReturnValue(builder);
  return builder;
}

describe("parseAdminJobListSearch", () => {
  it("usa pending, busca vazia, recent e página 1 por padrão", () => {
    expect(parseAdminJobListSearch(new URLSearchParams())).toEqual({
      status: "pending",
      query: "",
      sort: ADMIN_JOB_SORT_RECENT,
      page: 1,
      pageSize: ADMIN_JOB_PAGE_SIZE,
    });
  });

  it("lê status, q, sort e page sem PII extra", () => {
    const params = parseAdminJobListSearch(
      new URLSearchParams("status=approved&q=Nuvem&sort=oldest&page=3"),
    );
    expect(params).toEqual({
      status: "approved",
      query: "Nuvem",
      sort: ADMIN_JOB_SORT_OLDEST,
      page: 3,
      pageSize: 24,
    });
  });

  it("rejeita status e página inválidos", () => {
    const params = parseAdminJobListSearch(new URLSearchParams("status=draft&page=-2"));
    expect(params.status).toBe("pending");
    expect(params.page).toBe(1);
  });
});

describe("adminJobListSearchParams", () => {
  it("omite defaults para URL reproduzível e limpa", () => {
    const params = adminJobListSearchParams({
      status: "pending",
      query: "",
      sort: ADMIN_JOB_SORT_RECENT,
      page: 1,
    });
    expect(params.toString()).toBe("");
  });

  it("grava só filtros ativos", () => {
    const params = adminJobListSearchParams({
      status: "rejected",
      query: "React",
      sort: ADMIN_JOB_SORT_OLDEST,
      page: 2,
    });
    expect(params.get("status")).toBe("rejected");
    expect(params.get("q")).toBe("React");
    expect(params.get("sort")).toBe("oldest");
    expect(params.get("page")).toBe("2");
  });
});

describe("loadAdminJobPage", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("filtra pending, pagina 24, count exact e ordem created_at,id desc", async () => {
    const builder = mockListQuery();

    const page = await loadAdminJobPage();

    expect(fromMock).toHaveBeenCalledWith("jobs");
    expect(builder.select).toHaveBeenCalledWith(expect.stringContaining("title"), { count: "exact" });
    expect(builder.select.mock.calls[0][0]).not.toMatch(/description/);
    expect(builder.select.mock.calls[0][0]).not.toMatch(/job_curation_reviews/);
    expect(builder.eq).toHaveBeenCalledWith("status", "pending");
    expect(builder.order).toHaveBeenNthCalledWith(1, "created_at", { ascending: false });
    expect(builder.order).toHaveBeenNthCalledWith(2, "id", { ascending: false });
    expect(builder.range).toHaveBeenCalledWith(0, ADMIN_JOB_PAGE_SIZE - 1);
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(1);
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(24);
    expect(page.hasNext).toBe(false);
    expect(page.items[0]).toEqual({
      id: "j1",
      title: "Pessoa Estagiária (rascunho)",
      status: "pending",
      created_at: "2026-09-18T12:00:00.000Z",
      level: "intern",
      work_model: "remote",
      featured: false,
      companies: { name: "Nuvem Lauro Demo" },
    });
  });

  it("filtra approved no servidor", async () => {
    const builder = mockListQuery({ data: [], count: 0 });
    await loadAdminJobPage({ status: "approved" });
    expect(builder.eq).toHaveBeenCalledWith("status", "approved");
  });

  it("busca título e empresa via ilike no servidor", async () => {
    const builder = mockListQuery({ data: [], count: 0 });
    await loadAdminJobPage({ query: "Nuvem" });

    expect(builder.select.mock.calls[0][0]).toMatch(/co:companies\(\)/);
    expect(builder.filter).toHaveBeenCalledWith("co.name", "ilike", "%Nuvem%");
    expect(builder.or).toHaveBeenCalledWith(expect.stringContaining("title.ilike."));
    expect(builder.or).toHaveBeenCalledWith(expect.stringContaining("co.not.is.null"));
  });

  it("ordena mais antigas com created_at e id ascendentes", async () => {
    const builder = mockListQuery();
    await loadAdminJobPage({ sort: ADMIN_JOB_SORT_OLDEST });
    expect(builder.order).toHaveBeenNthCalledWith(1, "created_at", { ascending: true });
    expect(builder.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
  });

  it("página 2 usa range 24–47 e hasNext quando ainda há itens", async () => {
    const builder = mockListQuery({ data: [SAMPLE_ROW], count: 50 });
    const page = await loadAdminJobPage({ page: 2, pageSize: 24 });
    expect(builder.range).toHaveBeenCalledWith(24, 47);
    expect(page.page).toBe(2);
    expect(page.hasNext).toBe(true);
    expect(page.total).toBe(50);
  });

  it("hasNext é falso na última página", async () => {
    mockListQuery({ data: [SAMPLE_ROW], count: 25 });
    const page = await loadAdminJobPage({ page: 2, pageSize: 24 });
    expect(page.hasNext).toBe(false);
  });

  it("normaliza erro privilegiado do Supabase", async () => {
    mockListQuery({
      data: null,
      count: null,
      error: { message: "JWT does not contain aal2 claim" },
    });
    await expect(loadAdminJobPage()).rejects.toThrow(/Confirme o segundo fator/);
  });
});
