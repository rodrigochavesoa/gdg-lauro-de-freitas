import { describe, expect, it } from "vitest";
import { rankJobsByCompatibility, scoreJobMatch } from "./deterministic-match.js";

const candidate = (overrides = {}) => ({
  skills: ["React", "TypeScript"],
  preferences: { experience_level: "mid", work_model: "remote" },
  ...overrides,
});

describe("scoreJobMatch", () => {
  it("pontua 100 para coincidência total e gera razões objetivas", () => {
    const result = scoreJobMatch({
      stack: ["react", "TypeScript"],
      levelCode: "mid",
      workModelCode: "remote",
    }, candidate());

    expect(result.score).toBe(100);
    expect(result.matchReasons.map(({ key }) => key)).toEqual(["stack", "workModel", "seniority"]);
    expect(result.matchReasons[0].label).toBe("Tecnologias em comum: react, TypeScript");
    expect(JSON.stringify(result)).not.toMatch(/chance|probabilidade|contrata[cç][aã]o/i);
  });

  it("normaliza caixa, acentos e espaços para comparar tecnologias", () => {
    const result = scoreJobMatch({ stack: ["  TYPESCRIPT ", "São Paulo JS"] }, {
      skills: ["typescript", "sao paulo js"],
      preferences: {},
    });

    expect(result.score).toBe(50);
    expect(result.matchReasons[0].label).toBe("Tecnologias em comum: TYPESCRIPT, São Paulo JS");
  });

  it("deduplica tecnologias antes de calcular proporção", () => {
    const result = scoreJobMatch({ stack: ["React", "react", "Node"], levelCode: "unknown" }, {
      skills: ["React", "React"],
      preferences: {},
    });

    expect(result.score).toBe(50);
  });

  it("calcula proporção sobre as tecnologias do perfil presentes na vaga", () => {
    const result = scoreJobMatch({ stack: ["React", "Node"] }, {
      skills: ["React", "TypeScript"],
      preferences: {},
    });

    expect(result.score).toBe(25);
    expect(result.matchReasons[0].label).toBe("Tecnologias em comum: React");
  });

  it("zera somente dimensões com campos ausentes ou inválidos", () => {
    const result = scoreJobMatch({ stack: ["React"], levelCode: "mid" }, {
      skills: ["React"],
      preferences: { experience_level: "mid" },
    });

    expect(result.score).toBe(70);
    expect(result.matchReasons.map(({ key }) => key)).toEqual(["stack", "seniority"]);
  });

  it("não cria motivos para dimensões sem pontuação positiva", () => {
    const result = scoreJobMatch({ stack: ["Go"], levelCode: "intern", workModelCode: "onsite" }, candidate());
    expect(result.score).toBe(0);
    expect(result.matchReasons).toEqual([]);
  });

  it("trata lead da vaga como equivalente a senior", () => {
    expect(scoreJobMatch({ levelCode: "lead" }, {
      skills: [],
      preferences: { experience_level: "senior" },
    })).toMatchObject({ score: 20, matchReasons: [{ key: "seniority", label: "Nível compatível: Sênior" }] });
  });
});

describe("matriz de regime de trabalho 3x3", () => {
  const models = ["remote", "hybrid", "onsite"];
  const expected = [
    [30, 15, 0],
    [15, 30, 0],
    [0, 0, 30],
  ];

  for (const [candidateIndex, candidateModel] of models.entries()) {
    for (const [jobIndex, jobModel] of models.entries()) {
      it(`${candidateModel} × ${jobModel}`, () => {
        const result = scoreJobMatch({ workModelCode: jobModel }, {
          skills: [],
          preferences: { work_model: candidateModel },
        });
        expect(result.score).toBe(expected[candidateIndex][jobIndex]);
        expect(result.matchReasons.some(({ key }) => key === "workModel")).toBe(expected[candidateIndex][jobIndex] > 0);
      });
    }
  }
});

describe("matriz de senioridade 4x4", () => {
  const levels = ["intern", "junior", "mid", "senior"];
  const expected = [
    [20, 10, 0, 0],
    [10, 20, 10, 0],
    [0, 10, 20, 10],
    [0, 0, 10, 20],
  ];

  for (const [candidateIndex, candidateLevel] of levels.entries()) {
    for (const [jobIndex, jobLevel] of levels.entries()) {
      it(`${candidateLevel} × ${jobLevel}`, () => {
        const result = scoreJobMatch({ levelCode: jobLevel }, {
          skills: [],
          preferences: { experience_level: candidateLevel },
        });
        expect(result.score).toBe(expected[candidateIndex][jobIndex]);
        expect(result.matchReasons.some(({ key }) => key === "seniority")).toBe(expected[candidateIndex][jobIndex] > 0);
      });
    }
  }
});

describe("rankJobsByCompatibility", () => {
  it("ordena por score, depois data desc e id asc sem mutar a lista recebida", () => {
    const jobs = [
      { id: "b", postedAt: "2026-01-01", stack: ["React"] },
      { id: "z", postedAt: "2026-02-01", stack: ["Vue"] },
      { id: "a", postedAt: "2026-02-01", stack: ["Vue"] },
      { id: "high", stack: ["React", "TypeScript"], levelCode: "mid", workModelCode: "remote" },
    ];

    const ranked = rankJobsByCompatibility(jobs, candidate());
    expect(ranked.map(({ id }) => id)).toEqual(["high", "b", "a", "z"]);
    expect(jobs[0]).not.toHaveProperty("score");
  });

  it("preserva a partição de entrada, sem incluir vagas fora dos hard filters", () => {
    const filteredJobs = [{ id: "filtered-in", stack: ["React"] }];
    expect(rankJobsByCompatibility(filteredJobs, candidate()).map(({ id }) => id)).toEqual(["filtered-in"]);
  });
});
