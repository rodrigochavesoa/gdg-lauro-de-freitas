import { describe, expect, it } from "vitest";
import { companyColor, companyLogo, contrastRatio, formatJobSalary, formatPosted, LOGO_COLORS, LOGO_FG, mapJob, MIN_LOGO_CONTRAST_RATIO } from "./map-job.js";

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
    expect(job.postedAt).toBe(row.approved_at);
    expect(job.salary).toBe("A combinar");
  });

  it("formata a faixa em reais e mantém A combinar sem dados", () => {
    const money = (value) => value.replaceAll("\u00a0", " ");
    expect(formatJobSalary({})).toBe("A combinar");
    expect(money(formatJobSalary({ salary_min: 800000, salary_max: 1200000 }))).toBe(
      "R$ 8.000 – R$ 12.000",
    );
    expect(money(formatJobSalary({ salary_min: 800050, salary_max: 900000 }))).toBe(
      "R$ 8.000,50 – R$ 9.000",
    );
    expect(money(formatJobSalary({ salary_min: 500000 }))).toBe("A partir de R$ 5.000");
    expect(money(formatJobSalary({ salary_max: 700000 }))).toBe("Até R$ 7.000");
    expect(mapJob({ ...row, salary_min: 800000, salary_max: 1200000 }).salary.replaceAll("\u00a0", " ")).toBe(
      "R$ 8.000 – R$ 12.000",
    );
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
    expect(LOGO_COLORS).toHaveLength(4);
    for (const background of LOGO_COLORS) {
      expect(contrastRatio(LOGO_FG, background)).toBeGreaterThanOrEqual(MIN_LOGO_CONTRAST_RATIO);
    }
    expect(LOGO_COLORS).not.toContain("#fbbc04");
    expect(LOGO_COLORS).not.toContain("#4285f4");
  });
});

describe("formatPosted", () => {
  it("formata dias relativos", () => {
    expect(formatPosted(new Date(Date.now() - 3 * 86_400_000).toISOString())).toBe("há 3 dias");
  });
});
