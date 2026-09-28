import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { DETAIL_SURFACES, LIST_SURFACES, PRIVACY_PURPOSE_SELECT } from "./selects.js";
import { mapCatalogListRowToDto, mapIngestionListRowToDto, selectIdentifiers } from "./map-row.js";

function sourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "node_modules") continue;
      files.push(...sourceFiles(path));
      continue;
    }
    if (/\.(js|jsx)$/.test(entry)) files.push(path);
  }
  return files;
}

describe("contratos de dados", () => {
  it("listas não incluem coluna de detalhe", () => {
    for (const surface of LIST_SURFACES) {
      const tokens = new Set(selectIdentifiers(surface.select));
      const hits = surface.forbidden.filter((token) => tokens.has(token));
      expect(hits, surface.id).toEqual([]);
    }
  });

  it("detalhe continua explícito nas colunas pesadas", () => {
    for (const surface of DETAIL_SURFACES) {
      const tokens = new Set(selectIdentifiers(surface.select));
      for (const token of surface.required) {
        expect(tokens.has(token), `${surface.id} ${token}`).toBe(true);
      }
    }
  });

  it("privacidade lista as colunas do catálogo sem select estrela", () => {
    expect(PRIVACY_PURPOSE_SELECT).not.toBe("*");
    expect(selectIdentifiers(PRIVACY_PURPOSE_SELECT)).toEqual(expect.arrayContaining([
      "purpose_code",
      "version",
      "title",
      "specific_description",
    ]));
  });

  it("src não usa select estrela", () => {
    const root = join(import.meta.dirname, "..", "..");
    const hits = [];
    for (const file of sourceFiles(root)) {
      const text = readFileSync(file, "utf8");
      if (/\.select\(\s*["']\*["']\s*\)/.test(text)) hits.push(relative(root, file));
    }
    expect(hits).toEqual([]);
  });

  it("mapper rejeita linha sem campo obrigatório", () => {
    expect(() => mapCatalogListRowToDto({ id: "1", title: "Vaga" })).toThrow(
      /contrato de dados: campo obrigatório ausente \(catalog\.list\.status\)/,
    );
    expect(() => mapIngestionListRowToDto({ id: "ing-1" })).toThrow(
      /contrato de dados: campo obrigatório ausente \(ingest\.list\.source_kind\)/,
    );
  });
});
