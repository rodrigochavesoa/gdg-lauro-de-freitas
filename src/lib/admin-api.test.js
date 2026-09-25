import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.fn();

vi.mock("./supabase-client.js", () => ({
  getSupabaseBrowserClient: () => ({ from: fromMock }),
}));

import {
  COMPANY_LIST_LIMIT,
  createPendingJob,
  findDuplicateJob,
  loadAdminJobs,
  loadCompanies,
  normalizeJobTitle,
  parseStack,
  structuredJobColumns,
  updatePendingJob,
  validateAdminJob,
} from "./admin-api.js";

describe("validateAdminJob", () => {
  const valid = {
    title: "Pessoa Dev",
    description: "Vaga fictícia de teste.",
    companyId: "a1a1a1a1-0001-4000-8000-000000000001",
    level: "Pleno",
    workModel: "Remoto",
  };

  it("aceita payload mínimo válido", () => {
    expect(validateAdminJob(valid)).toEqual([]);
  });

  it("exige título, descrição, empresa, nível e modelo", () => {
    expect(validateAdminJob({})).toEqual([
      "Título é obrigatório.",
      "Descrição é obrigatória.",
      "Selecione uma empresa ou informe o nome de uma empresa fictícia.",
      "Nível é obrigatório.",
      "Modelo de trabalho é obrigatório.",
    ]);
  });

  it("aceita empresa nova no lugar do select", () => {
    expect(validateAdminJob({ ...valid, companyId: "", newCompanyName: "Empresa Fictícia Lab" })).toEqual([]);
  });

  it("aceita país e faixa vazios e não lê o país na localidade", () => {
    expect(validateAdminJob({ ...valid, location: "Brasil" })).toEqual([]);
    expect(
      structuredJobColumns({ location: "Brasil", countryCode: "", salaryMinText: "", salaryMaxText: "" }).columns,
    ).toEqual({
      country_code: null,
      salary_min: null,
      salary_max: null,
    });
  });

  it("grava país ISO e faixa em centavos", () => {
    expect(
      structuredJobColumns({
        countryCode: "br",
        salaryMinText: "8.000",
        salaryMaxText: "12.000,50",
      }),
    ).toEqual({
      errors: [],
      columns: { country_code: "BR", salary_min: 800000, salary_max: 1200050 },
    });
  });

  it("aceita um só extremo e recusa mínimo maior que o máximo", () => {
    expect(structuredJobColumns({ salaryMinText: "5000", salaryMaxText: "" }).columns).toEqual({
      country_code: null,
      salary_min: 500000,
      salary_max: null,
    });
    expect(validateAdminJob({ ...valid, salaryMinText: "12000", salaryMaxText: "8000" })).toContain(
      "A faixa mínima não pode ser maior que a máxima.",
    );
    expect(validateAdminJob({ ...valid, countryCode: "Brasil" })).toContain(
      "País deve ser um código ISO de duas letras.",
    );
  });
});

describe("parseStack", () => {
  it("separa tecnologias por vírgula", () => {
    expect(parseStack("React, TypeScript, Next.js")).toEqual(["React", "TypeScript", "Next.js"]);
  });
});

describe("normalizeJobTitle e duplicidade", () => {
  it("normaliza trim, espaços e caixa", () => {
    expect(normalizeJobTitle("  Pessoa   Dev  ")).toBe("pessoa dev");
  });

  it("detecta o mesmo título na mesma empresa", () => {
    const jobs = [
      { id: "a", company_id: "c1", title: "Pessoa Dev" },
      { id: "b", company_id: "c2", title: "Pessoa Dev" },
    ];
    expect(findDuplicateJob(jobs, { companyId: "c1", title: "pessoa   DEV" })?.id).toBe("a");
    expect(findDuplicateJob(jobs, { companyId: "c1", title: "pessoa   DEV", excludeId: "a" })).toBeNull();
    expect(findDuplicateJob(jobs, { companyId: "c2", title: "Outra" })).toBeNull();
  });
});

function chain(terminal) {
  const builder = {};
  for (const name of ["select", "order", "eq", "ilike", "neq", "insert", "update"]) {
    builder[name] = vi.fn(() => builder);
  }
  builder.limit = vi.fn(() => Promise.resolve(terminal));
  builder.single = vi.fn(() => Promise.resolve(terminal));
  builder.maybeSingle = vi.fn(() => Promise.resolve(terminal));
  return builder;
}

const jobInput = {
  title: "Pessoa Dev",
  description: "Vaga fictícia de teste.",
  companyId: "a1a1a1a1-0001-4000-8000-000000000001",
  level: "Pleno",
  workModel: "Remoto",
};

describe("listas staff com teto", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("loadCompanies corta o select em COMPANY_LIST_LIMIT", async () => {
    const builder = chain({ data: [{ id: "c1", name: "Nuvem" }], error: null });
    fromMock.mockReturnValue(builder);

    await expect(loadCompanies()).resolves.toEqual([{ id: "c1", name: "Nuvem" }]);
    expect(fromMock).toHaveBeenCalledWith("companies");
    expect(builder.select).toHaveBeenCalledWith("id,name");
    expect(builder.limit).toHaveBeenCalledWith(COMPANY_LIST_LIMIT);
    expect(builder.select).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ count: "exact" }));
  });

  it("loadAdminJobs não baixa a tabela de jobs", async () => {
    await expect(loadAdminJobs()).rejects.toThrow(/loadAdminJobPage/);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rotas de lista e formulário não importam loadAdminJobs", () => {
    const root = resolve(import.meta.dirname, "..");
    const jobsRoute = readFileSync(resolve(root, "features/admin/AdminJobsRoute.jsx"), "utf8");
    const formRoute = readFileSync(resolve(root, "features/admin/AdminJobFormRoute.jsx"), "utf8");
    expect(jobsRoute).not.toContain("loadAdminJobs");
    expect(formRoute).not.toContain("loadAdminJobs");
    expect(jobsRoute).toContain("loadAdminJobPage");
    expect(formRoute).toContain("loadCompanies");
  });

  it("createPendingJob sonda o título com ilike e limite, sem varrer a empresa", async () => {
    const probe = chain({ data: [], error: null });
    const insert = chain({ data: { id: "j1", title: "Pessoa Dev", status: "pending" }, error: null });
    fromMock.mockReturnValueOnce(probe).mockReturnValueOnce(insert);

    await createPendingJob(jobInput);

    expect(probe.select).toHaveBeenCalledWith("id,title,company_id");
    expect(probe.eq).toHaveBeenCalledWith("company_id", jobInput.companyId);
    expect(probe.ilike).toHaveBeenCalledWith("title", "Pessoa Dev");
    expect(probe.limit).toHaveBeenCalledWith(5);
    expect(insert.insert).toHaveBeenCalled();
  });

  it("updatePendingJob exclui a própria vaga na sonda", async () => {
    const probe = chain({ data: [], error: null });
    const update = chain({ data: { id: "j1", title: "Pessoa Dev", status: "pending" }, error: null });
    fromMock.mockReturnValueOnce(probe).mockReturnValueOnce(update);

    await updatePendingJob("j1", jobInput);

    expect(probe.ilike).toHaveBeenCalledWith("title", "Pessoa Dev");
    expect(probe.neq).toHaveBeenCalledWith("id", "j1");
    expect(probe.limit).toHaveBeenCalledWith(5);
  });

  it("recusa título duplicado sem insert", async () => {
    const probe = chain({
      data: [{ id: "other", company_id: jobInput.companyId, title: "pessoa dev" }],
      error: null,
    });
    fromMock.mockReturnValue(probe);

    await expect(createPendingJob(jobInput)).rejects.toThrow(/Já existe vaga/);
    expect(probe.limit).toHaveBeenCalledWith(5);
  });
});
