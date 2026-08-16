import { describe, expect, it } from "vitest";
import { parseStack, validateAdminJob } from "./admin-api.js";

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
});

describe("parseStack", () => {
  it("separa tecnologias por vírgula", () => {
    expect(parseStack("React, TypeScript, Next.js")).toEqual(["React", "TypeScript", "Next.js"]);
  });
});
