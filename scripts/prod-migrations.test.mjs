import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FICTITIOUS_SEED_UUIDS,
  assertProdSafeSql,
  isProdSafeMigration,
  listHomologOnlyMigrations,
  listProdSafeMigrations,
  validateProdMigrations,
} from "./prod-migrations.mjs";

describe("prod migrations", () => {
  it("classifica seed fictício como homolog-only", () => {
    expect(isProdSafeMigration("202608160002_seed_fictitious_catalog.sql")).toBe(false);
    expect(isProdSafeMigration("202608150001_ai_matching.sql")).toBe(true);
    expect(isProdSafeMigration("20260912010000_data_api_select_grants.sql")).toBe(true);
  });

  it("o repositório tem seed só em homologação e SQL de prod sem UUIDs fictícios", () => {
    const { prod, homologOnly } = validateProdMigrations();
    expect(homologOnly.some((name) => name.includes("seed_fictitious"))).toBe(true);
    expect(prod.some((name) => name.includes("data_api_select_grants"))).toBe(true);
    expect(listProdSafeMigrations()).toEqual(prod);
    expect(listHomologOnlyMigrations()).toEqual(homologOnly);
  });

  it("rejeita UUID de seed em arquivo que deveria ir para produção", () => {
    expect(() =>
      assertProdSafeSql(`insert into jobs (id) values ('${FICTITIOUS_SEED_UUIDS[0]}')`, "oops.sql"),
    ).toThrow(/seed fictício/);
  });

  it("validateProdMigrations falha se o seed sumir do diretório", () => {
    const dir = mkdtempSync(join(tmpdir(), "gdg-mig-"));
    writeFileSync(join(dir, "202608150001_ai_matching.sql"), "select 1;\n");
    expect(() => validateProdMigrations(dir)).toThrow(/seed fictício/);
  });
});
