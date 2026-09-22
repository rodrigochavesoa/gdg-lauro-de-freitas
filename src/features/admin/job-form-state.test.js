import { describe, expect, it } from "vitest";
import { adminJobStatusLabel, emptyJobForm, jobToForm } from "./job-form-state.js";

describe("job-form-state", () => {
  it("converte vaga pendente para o formulário atual", () => {
    expect(jobToForm({
      title: "Pessoa Dev",
      company_id: "c1",
      level: "mid",
      work_model: "hybrid",
      description: "Texto",
      stack: ["React", "TypeScript"],
      location: "Salvador",
    })).toEqual({
      ...emptyJobForm,
      title: "Pessoa Dev",
      companyId: "c1",
      level: "Pleno",
      workModel: "Híbrido",
      description: "Texto",
      stackText: "React, TypeScript",
      location: "Salvador",
    });
  });

  it("reabre país e faixa em reais sem inventar país", () => {
    expect(
      jobToForm({
        title: "Pessoa Dev",
        location: "Brasil",
        country_code: "BR",
        salary_min: 800000,
        salary_max: null,
      }),
    ).toMatchObject({
      location: "Brasil",
      countryCode: "BR",
      salaryMinText: "8000",
      salaryMaxText: "",
    });
    expect(jobToForm({ title: "Sem estrutura", location: "Brasil" })).toMatchObject({
      countryCode: "",
      salaryMinText: "",
      salaryMaxText: "",
    });
  });

  it("rótula status sem expor pending/approved crus", () => {
    expect(adminJobStatusLabel("pending")).toBe("Pendente");
    expect(adminJobStatusLabel("approved")).toBe("Publicada");
    expect(adminJobStatusLabel("rejected")).toBe("Rejeitada");
  });
});
