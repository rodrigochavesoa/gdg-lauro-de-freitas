import { describe, expect, it } from "vitest";
import { APPLICATION_STATUS_FILTER_OPTIONS, filterMyApplications } from "./filter-my-applications.js";

const rows = [
  { jobTitle: "Pessoa Desenvolvedora Front-end", companyName: "Nuvem Lauro Demo", status: "submitted" },
  { jobTitle: "Pessoa Analista de Dados", companyName: "Oficina Norte", status: "withdrawn" },
  { jobTitle: "Pessoa em revisão", companyName: "Estúdio Sul", status: "reviewing" },
];

describe("filterMyApplications", () => {
  it("mapeia os rótulos do contrato de status", () => {
    expect(APPLICATION_STATUS_FILTER_OPTIONS.map((option) => option.label)).toEqual([
      "Todas",
      "Em análise",
      "Enviada",
      "Retirada",
      "Aceita",
      "Encerrada",
    ]);
  });

  it("filtra por status e pelo texto de título, empresa ou rótulo", () => {
    expect(filterMyApplications(rows, { status: "withdrawn" })).toEqual([rows[1]]);
    expect(filterMyApplications(rows, { query: "em análise" })).toEqual([rows[2]]);
    expect(filterMyApplications(rows, { query: "  NUVEM " })).toEqual([rows[0]]);
    expect(filterMyApplications(rows, { query: "oficina", status: "submitted" })).toEqual([]);
  });
});
