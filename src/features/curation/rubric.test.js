import { describe, expect, it } from "vitest";
import { validateCurationReview, validateUrgentPriority } from "./rubric.js";

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
