import { describe, expect, it } from "vitest";
import {
  centsFromReaisInput,
  parseCatalogSearch,
  reaisInputFromCents,
  serializeCatalogSearch,
  writeCatalogSearch,
} from "./catalog-url.js";

describe("parseCatalogSearch", () => {
  it("lê país, localidade, faixa e filtros existentes", () => {
    const parsed = parseCatalogSearch(
      "?query=React&tech=React&tech=Python&level=Pleno&workModel=Remoto&sort=oldest&country=br&place=salvador&salaryMin=800000&salaryMax=1200000",
    );
    expect(parsed).toMatchObject({
      query: "React",
      tech: ["React", "Python"],
      level: ["Pleno"],
      workModel: ["Remoto"],
      sort: "oldest",
      country: "BR",
      place: "salvador",
      salaryMin: 800000,
      salaryMax: 1200000,
    });
  });

  it("ignora salário negativo, decimal, enorme e faixa invertida", () => {
    expect(parseCatalogSearch("?salaryMin=-1&salaryMax=100").salaryMin).toBeNull();
    expect(parseCatalogSearch("?salaryMin=10.5").salaryMin).toBeNull();
    expect(parseCatalogSearch("?salaryMax=2147483648").salaryMax).toBeNull();
    const inverted = parseCatalogSearch("?salaryMin=2000000&salaryMax=100");
    expect(inverted.salaryMin).toBeNull();
    expect(inverted.salaryMax).toBeNull();
  });

  it("descarta país inválido, faixa invertida e listas fora do catálogo", () => {
    const parsed = parseCatalogSearch("?country=brasil&tech=Cobol&salaryMin=20&salaryMax=10&sort=novo");
    expect(parsed.country).toBe("");
    expect(parsed.tech).toEqual([]);
    expect(parsed.salaryMin).toBeNull();
    expect(parsed.salaryMax).toBeNull();
    expect(parsed.sort).toBe("recent");
  });

  it("serializa e reabre o mesmo estado", () => {
    const params = serializeCatalogSearch({
      query: "Node",
      tech: ["Node.js"],
      level: ["Júnior"],
      workModel: ["Híbrido"],
      sort: "oldest",
      country: "PT",
      place: "Lisboa",
      salaryMin: 500000,
      salaryMax: null,
    });
    expect(parseCatalogSearch(params)).toMatchObject({
      query: "Node",
      tech: ["Node.js"],
      level: ["Júnior"],
      workModel: ["Híbrido"],
      sort: "oldest",
      country: "PT",
      place: "Lisboa",
      salaryMin: 500000,
      salaryMax: null,
    });
    expect(params.get("sort")).toBe("oldest");
    expect(params.has("salaryMax")).toBe(false);
  });

  it("writeCatalogSearch preserva a query ao trocar o país", () => {
    const next = writeCatalogSearch("?query=React&country=BR", { country: "US" });
    expect(next.get("query")).toBe("React");
    expect(next.get("country")).toBe("US");
  });
});

describe("centavos e reais", () => {
  it("converte entrada pt-BR para centavos", () => {
    expect(centsFromReaisInput("8.000")).toEqual({ cents: 800000 });
    expect(centsFromReaisInput("8000,50")).toEqual({ cents: 800050 });
    expect(centsFromReaisInput("")).toEqual({ cents: null });
    expect(centsFromReaisInput("abc").error).toBeTruthy();
  });

  it("mostra centavos no campo sem agrupamento", () => {
    expect(reaisInputFromCents(800000).replaceAll("\u00a0", " ")).toBe("8000");
    expect(reaisInputFromCents(800050).replaceAll("\u00a0", " ")).toBe("8000,5");
    expect(reaisInputFromCents(null)).toBe("");
  });
});
