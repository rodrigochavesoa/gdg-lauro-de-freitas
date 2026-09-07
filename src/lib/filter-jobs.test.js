import { describe, expect, it } from "vitest";
import { filterJobs, SORT_OLDEST, SORT_RECENT, sortJobs, toggleFilterValue } from "./filter-jobs.js";

const jobs = [
  {
    id: 1,
    title: "Pessoa Desenvolvedora Front-end",
    company: "Zup Innovation",
    level: "Pleno",
    stack: ["React", "TypeScript", "Next.js"],
  },
  {
    id: 2,
    title: "Desenvolvedor(a) Back-end Node.js",
    company: "Cora",
    level: "Júnior",
    stack: ["Node.js", "PostgreSQL", "AWS"],
  },
  {
    id: 3,
    title: "Product Designer",
    company: "Loft",
    level: "Pleno",
    stack: ["Figma", "UX Research", "Design System"],
  },
  {
    id: 4,
    title: "Pessoa Engenheira de Dados",
    company: "iFood",
    level: "Sênior",
    stack: ["Python", "SQL", "Databricks"],
  },
];

describe("filterJobs", () => {
  it("retorna todas as vagas sem busca nem filtros", () => {
    expect(filterJobs(jobs).map((job) => job.id)).toEqual([1, 2, 3, 4]);
  });

  it("busca por cargo, empresa ou tecnologia sem diferenciar maiúsculas", () => {
    expect(filterJobs(jobs, { query: "react" }).map((job) => job.id)).toEqual([1]);
    expect(filterJobs(jobs, { query: "CORA" }).map((job) => job.id)).toEqual([2]);
    expect(filterJobs(jobs, { query: "designer" }).map((job) => job.id)).toEqual([3]);
  });

  it("filtra por tecnologia com correspondência parcial na stack", () => {
    expect(filterJobs(jobs, { tech: ["React"] }).map((job) => job.id)).toEqual([1]);
    expect(filterJobs(jobs, { tech: ["Node.js"] }).map((job) => job.id)).toEqual([2]);
    expect(filterJobs(jobs, { tech: ["Python"] }).map((job) => job.id)).toEqual([4]);
  });

  it("filtra por nível de experiência", () => {
    expect(filterJobs(jobs, { level: ["Pleno"] }).map((job) => job.id)).toEqual([1, 3]);
    expect(filterJobs(jobs, { level: ["Sênior"] }).map((job) => job.id)).toEqual([4]);
  });

  it("combina busca e filtros e devolve lista vazia quando não há match", () => {
    expect(filterJobs(jobs, { query: "React", level: ["Pleno"] }).map((job) => job.id)).toEqual([1]);
    expect(filterJobs(jobs, { query: "React", level: ["Júnior"] })).toEqual([]);
    expect(filterJobs(jobs, { query: "inexistente" })).toEqual([]);
  });
});

describe("sortJobs", () => {
  const dated = [
    { id: "old", postedAt: "2026-01-01T00:00:00.000Z" },
    { id: "new", postedAt: "2026-09-01T00:00:00.000Z" },
    { id: "mid", postedAt: "2026-06-01T00:00:00.000Z" },
  ];

  it("ordena mais recentes por padrão (postedAt desc)", () => {
    expect(sortJobs(dated).map((job) => job.id)).toEqual(["new", "mid", "old"]);
    expect(sortJobs(dated, SORT_RECENT).map((job) => job.id)).toEqual(["new", "mid", "old"]);
  });

  it("ordena mais antigas (postedAt asc)", () => {
    expect(sortJobs(dated, SORT_OLDEST).map((job) => job.id)).toEqual(["old", "mid", "new"]);
  });
});

describe("toggleFilterValue", () => {
  it("adiciona e remove o valor selecionado", () => {
    expect(toggleFilterValue("React", [])).toEqual(["React"]);
    expect(toggleFilterValue("React", ["React", "Python"])).toEqual(["Python"]);
  });
});
