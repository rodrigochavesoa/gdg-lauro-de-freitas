import { describe, expect, it } from "vitest";
import { validateCurationReview, validateUrgentPriority, rubricLabel, sortCurationReviews } from "./rubric.js";

describe("validateCurationReview", () => {
  it("exige decisão e código da rubrica", () => {
    expect(validateCurationReview({})).toEqual([
      "Escolha aprovar ou rejeitar.",
      "Código da rubrica é obrigatório.",
    ]);
  });

  it("aceita parecer válido", () => {
    expect(
      validateCurationReview({ decision: "reject", rubricCode: "R1-empresa-identificavel" }),
    ).toEqual([]);
  });
});

describe("validateUrgentPriority", () => {
  it("exige motivo para urgente", () => {
    expect(validateUrgentPriority(" ")).toBe("Motivo interno é obrigatório para prioridade urgente.");
    expect(validateUrgentPriority("SLA interno")).toBe("");
  });
});

describe("rubricLabel e sortCurationReviews", () => {
  it("resolve o rótulo da rubrica D-04", () => {
    expect(rubricLabel("R1-empresa-identificavel")).toBe("Empresa e oportunidade identificáveis");
  });

  it("ordena pareceres por rodada e data", () => {
    const sorted = sortCurationReviews([
      { curation_round: 2, created_at: "2026-09-15T10:00:00Z", decision: "approve" },
      { curation_round: 1, created_at: "2026-09-14T12:00:00Z", decision: "reject" },
      { curation_round: 1, created_at: "2026-09-14T11:00:00Z", decision: "approve" },
    ]);
    expect(sorted.map((row) => row.decision)).toEqual(["approve", "reject", "approve"]);
    expect(sorted.map((row) => row.curation_round)).toEqual([1, 1, 2]);
  });
});
