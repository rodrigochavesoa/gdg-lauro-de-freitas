import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FICTITIOUS_SEED_UUIDS,
  PROD_MANIFEST_FILENAME,
  assertProdSafeSql,
  classifyNonManifestSql,
  isHomologOnlyMigration,
  isProdSafeMigration,
  listHomologOnlyMigrations,
  listProdSafeMigrations,
  validateProdMigrations,
} from "./prod-migrations.mjs";

function writeTempMigrations({ manifest, files = {} }) {
  const dir = mkdtempSync(join(tmpdir(), "gdg-mig-"));
  writeFileSync(join(dir, "202608160002_seed_fictitious_catalog.sql"), "-- homolog seed\n");
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), body);
  }
  writeFileSync(join(dir, PROD_MANIFEST_FILENAME), JSON.stringify(manifest));
  return dir;
}

describe("prod migrations", () => {
  it("classifica seed fictício e avatars como homolog-only por pattern", () => {
    expect(isHomologOnlyMigration("202608160002_seed_fictitious_catalog.sql")).toBe(true);
    expect(isHomologOnlyMigration("20260916122300_avatars_storage_homolog.sql")).toBe(true);
    expect(isHomologOnlyMigration("20260916153000_avatars_single_object_homolog.sql")).toBe(true);
    expect(isHomologOnlyMigration("20260916153100_avatars_single_object.sql")).toBe(true);
    expect(isHomologOnlyMigration("202608150001_ai_matching.sql")).toBe(false);
    expect(isHomologOnlyMigration("20260915154949_job_submission_staff_dedup.sql")).toBe(false);
  });

  it("usa o manifesto como fonte de verdade — 15 arquivos, sem staff_dedup", () => {
    expect(isProdSafeMigration("202608160002_seed_fictitious_catalog.sql")).toBe(false);
    expect(isProdSafeMigration("20260916122300_avatars_storage_homolog.sql")).toBe(false);
    expect(isProdSafeMigration("20260916153000_avatars_single_object_homolog.sql")).toBe(false);
    expect(isProdSafeMigration("20260916153100_avatars_single_object.sql")).toBe(false);
    expect(isProdSafeMigration("20260915154949_job_submission_staff_dedup.sql")).toBe(false);
    expect(isProdSafeMigration("202608150001_ai_matching.sql")).toBe(true);
    expect(isProdSafeMigration("20260912010000_data_api_select_grants.sql")).toBe(true);

    const { prod, homologOnly, camadaB } = validateProdMigrations();
    expect(prod).toHaveLength(15);
    expect(prod.some((name) => name.includes("job_submission_staff_dedup"))).toBe(false);
    expect(camadaB.some((name) => name.includes("job_submission_staff_dedup"))).toBe(true);
    expect(homologOnly.some((name) => name.includes("seed_fictitious"))).toBe(true);
    expect(prod.some((name) => name.includes("data_api_select_grants"))).toBe(true);
    expect(listProdSafeMigrations()).toEqual(prod);
    expect(listHomologOnlyMigrations()).toEqual(homologOnly);
    expect(classifyNonManifestSql().unclassified).toEqual([]);
  });

  it("rejeita UUID de seed em arquivo que deveria ir para produção", () => {
    expect(() =>
      assertProdSafeSql(`insert into jobs (id) values ('${FICTITIOUS_SEED_UUIDS[0]}')`, "oops.sql"),
    ).toThrow(/seed fictício/);
  });

  it("rejeita SQL marcado para não aplicar em produção", () => {
    expect(() =>
      assertProdSafeSql("-- Homologação: ok. Produção: não aplicar (Camada B / PO).\n", "blocked.sql"),
    ).toThrow(/não aplicar em produção/);
    expect(() =>
      assertProdSafeSql("-- este arquivo: não aplicar em produção\n", "blocked.sql"),
    ).toThrow(/não aplicar em produção/);
  });

  it("validateProdMigrations falha se o seed sumir do diretório", () => {
    const dir = mkdtempSync(join(tmpdir(), "gdg-mig-"));
    writeFileSync(join(dir, "202608150001_ai_matching.sql"), "select 1;\n");
    writeFileSync(
      join(dir, PROD_MANIFEST_FILENAME),
      JSON.stringify(["202608150001_ai_matching.sql"]),
    );
    expect(() => validateProdMigrations(dir)).toThrow(/seed fictício/);
  });

  it("bloqueia manifesto cuja entrada contém marker de produção", () => {
    const dir = writeTempMigrations({
      manifest: ["blocked.sql"],
      files: {
        "blocked.sql": "-- Produção: não aplicar (Camada B / PO).\nselect 1;\n",
      },
    });
    expect(() => validateProdMigrations(dir)).toThrow(/não aplicar em produção/);
  });

  it("bloqueia entrada do manifesto cujo arquivo não existe", () => {
    const dir = writeTempMigrations({
      manifest: ["ghost.sql"],
    });
    expect(() => validateProdMigrations(dir)).toThrow(/não existe/);
  });

  it("falha se houver migration sem classificação", () => {
    const dir = writeTempMigrations({
      manifest: ["ok.sql"],
      files: {
        "ok.sql": "select 1;\n",
        "orphan.sql": "select 1;\n",
      },
    });
    expect(() => validateProdMigrations(dir)).toThrow(/sem classificação/);
    expect(() => validateProdMigrations(dir)).toThrow(/orphan\.sql/);
  });

  it("aceita migration fora do manifesto só quando marcada para não aplicar", () => {
    const dir = writeTempMigrations({
      manifest: ["ok.sql"],
      files: {
        "ok.sql": "select 1;\n",
        "pending.sql": "-- Produção: não aplicar (Camada B / PO).\nselect 1;\n",
      },
    });
    const { prod, camadaB } = validateProdMigrations(dir);
    expect(prod).toEqual(["ok.sql"]);
    expect(camadaB).toEqual(["pending.sql"]);
  });
});
