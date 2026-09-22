import { describe, expect, it } from "vitest";
import { parseStack, structuredJobColumns, validateAdminJob, normalizeJobTitle, findDuplicateJob } from "./admin-api.js";

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
