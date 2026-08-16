import { describe, expect, it } from "vitest";
import { companyColor, companyLogo, formatPosted, mapJob } from "./map-job.js";

const row = {
  id: "b2b2b2b2-0001-4000-8000-000000000001",
  title: "Pessoa Desenvolvedora Front-end",
  description: "Descrição fictícia.",
  requirements: {
    mandatory: ["Construir interfaces acessíveis e performáticas"],
    desirable: [],
  },
  stack: ["React", "TypeScript"],
  level: "mid",
  work_model: "remote",
  location: "Brasil",
  status: "approved",
  approved_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  created_at: new Date().toISOString(),
  companies: {
    name: "Nuvem Lauro Demo",
    description: "Empresa fictícia de teste.",
  },
};

describe("mapJob", () => {
  it("traduz nível, local e responsabilidades do seed", () => {
    const job = mapJob(row);
    expect(job.level).toBe("Pleno");
    expect(job.place).toBe("Brasil · Remoto");
    expect(job.company).toBe("Nuvem Lauro Demo");
    expect(job.responsibilities).toEqual(["Construir interfaces acessíveis e performáticas"]);
    expect(job.status).toBe("approved");
  });

  it("não promove vaga pendente no mapper — o status segue o banco", () => {
    const pending = mapJob({ ...row, status: "pending", approved_at: null });
    expect(pending.status).toBe("pending");
  });
});

describe("companyLogo e companyColor", () => {
  it("gera iniciais e cor determinística", () => {
    expect(companyLogo("Nuvem Lauro Demo")).toBe("NL");
    expect(companyColor("Nuvem Lauro Demo")).toMatch(/^#/);
  });
});

describe("formatPosted", () => {
  it("formata dias relativos", () => {
    expect(formatPosted(new Date(Date.now() - 3 * 86_400_000).toISOString())).toBe("há 3 dias");
  });
});
