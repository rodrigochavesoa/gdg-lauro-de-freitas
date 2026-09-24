import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FICTITIOUS_SEED_UUIDS,
  PROD_MANIFEST_FILENAME,
  applyHomologChain,
  OFFICIAL_HOMOLOG_PROJECT_REF,
  OFFICIAL_PROD_PROJECT_REF,
  assertHomologDatabaseUrl,
  assertProdSafeSql,
  classifyNonManifestSql,
  heldMigrationsDir,
  homologMigrationsDir,
  isHomologOnlyMigration,
  isProdSafeMigration,
  HOMOLOG_HISTORY_REPAIRS,
  listHomologChain,
  listHomologOnlyMigrations,
  listProdSafeMigrations,
  migrationVersion,
  planHomologApply,
  psqlInvocation,
  repairHomologHistory,
  resolveHomologChain,
  validateProdMigrations,
} from "./prod-migrations.mjs";

function writeTempMigrations({ manifest, files = {}, homologFiles = {}, heldFiles = {} }) {
  const dir = mkdtempSync(join(tmpdir(), "gdg-mig-"));
  const homologDir = homologMigrationsDir(dir);
  const heldDir = heldMigrationsDir(dir);
  mkdirSync(homologDir);
  mkdirSync(heldDir);
  writeFileSync(join(homologDir, "202608160002_seed_fictitious_catalog.sql"), "-- homolog seed\n");
  for (const [name, body] of Object.entries(homologFiles)) {
    writeFileSync(join(homologDir, name), body);
  }
  for (const [name, body] of Object.entries(heldFiles)) {
    writeFileSync(join(heldDir, name), body);
  }
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
    expect(isHomologOnlyMigration("20260919120000_avatars_versioned_path_homolog.sql")).toBe(true);
    expect(isHomologOnlyMigration("20260919120001_avatars_versioned_path.sql")).toBe(true);
    expect(isHomologOnlyMigration("20260920010148_job_ingestions_source_contract_homolog.sql")).toBe(true);
    expect(isHomologOnlyMigration("20260920020100_job_ingestions_register_rpc_homolog.sql")).toBe(true);
    expect(isHomologOnlyMigration("20260920030000_staff_cannot_apply_homolog.sql")).toBe(true);
    expect(isHomologOnlyMigration("20260920040000_job_ingestions_process_homolog.sql")).toBe(true);
    expect(isHomologOnlyMigration("20260923140000_job_ingestion_staff_list_homolog.sql")).toBe(true);
    expect(isHomologOnlyMigration("20260921120000_sec_db_function_hardening_homolog.sql")).toBe(true);
    expect(isHomologOnlyMigration("20261001000000_job_ingestions_source_contract_prod.sql")).toBe(false);
    expect(isHomologOnlyMigration("20261001000001_job_ingestions_phase_b.sql")).toBe(false);
    expect(isHomologOnlyMigration("202608150001_ai_matching.sql")).toBe(false);
    expect(isHomologOnlyMigration("20260915154949_job_submission_staff_dedup.sql")).toBe(false);
  });

  it("usa o manifesto como fonte de verdade — 15 arquivos, sem staff_dedup", () => {
    expect(isProdSafeMigration("202608160002_seed_fictitious_catalog.sql")).toBe(false);
    expect(isProdSafeMigration("20260916122300_avatars_storage_homolog.sql")).toBe(false);
    expect(isProdSafeMigration("20260916153000_avatars_single_object_homolog.sql")).toBe(false);
    expect(isProdSafeMigration("20260916153100_avatars_single_object.sql")).toBe(false);
    expect(isProdSafeMigration("20260919120000_avatars_versioned_path_homolog.sql")).toBe(false);
    expect(isProdSafeMigration("20260919120001_avatars_versioned_path.sql")).toBe(false);
    expect(isProdSafeMigration("20260920010148_job_ingestions_source_contract_homolog.sql")).toBe(false);
    expect(isProdSafeMigration("20260920020100_job_ingestions_register_rpc_homolog.sql")).toBe(false);
    expect(isProdSafeMigration("20260920030000_staff_cannot_apply_homolog.sql")).toBe(false);
    expect(isProdSafeMigration("20260920040000_job_ingestions_process_homolog.sql")).toBe(false);
    expect(isProdSafeMigration("20260915154949_job_submission_staff_dedup.sql")).toBe(false);
    expect(isProdSafeMigration("202608150001_ai_matching.sql")).toBe(true);
    expect(isProdSafeMigration("20260912010000_data_api_select_grants.sql")).toBe(true);

    const { prod, homologOnly, camadaB } = validateProdMigrations();
    expect(prod).toHaveLength(15);
    expect(prod.some((name) => name.includes("job_submission_staff_dedup"))).toBe(false);
    expect(camadaB.some((name) => name.includes("job_submission_staff_dedup"))).toBe(true);
    expect(camadaB.some((name) => name.includes("staff_rls_aal2"))).toBe(true);
    expect(homologOnly.some((name) => name.includes("seed_fictitious"))).toBe(true);
    expect(homologOnly.some((name) => name.includes("job_ingestions_source_contract_homolog"))).toBe(true);
    expect(homologOnly.some((name) => name.includes("job_ingestions_process_homolog"))).toBe(true);
    expect(prod.some((name) => name.includes("data_api_select_grants"))).toBe(true);
    expect(listProdSafeMigrations()).toEqual(prod);
    expect(listHomologOnlyMigrations()).toEqual(homologOnly);
    expect(classifyNonManifestSql().unclassified).toEqual([]);
    const chain = listHomologChain();
    expect(prod.every((name) => chain.includes(name))).toBe(true);
    expect(chain.some((name) => name.includes("seed_fictitious"))).toBe(true);
    expect(chain.indexOf("202608160002_seed_fictitious_catalog.sql")).toBeGreaterThan(
      chain.indexOf("202608150001_ai_matching.sql"),
    );
  });

  it("registra dívida GOV-AVATAR-MIG-CLASS-01: avatars_ ainda pega Camada B sem _homolog", () => {
    // Prefix legado mais amplo que _homolog.sql. Não apertar neste PR.
    expect(isHomologOnlyMigration("20260919120001_avatars_versioned_path.sql")).toBe(true);
    expect(isHomologOnlyMigration("20260916153100_avatars_single_object.sql")).toBe(true);
    expect(isHomologOnlyMigration("20990101000000_avatars_unrelated_prod.sql")).toBe(true);
    expect(isHomologOnlyMigration("20990101000001_storage_prod.sql")).toBe(false);
  });

  it("não classifica job_ingestions_*_prod.sql como homolog-only", () => {
    const prodName = "20261001000000_job_ingestions_source_contract_prod.sql";
    expect(isHomologOnlyMigration(prodName)).toBe(false);
    const dir = writeTempMigrations({
      manifest: ["ok.sql"],
      files: {
        "ok.sql": "select 1;\n",
        [prodName]: "select 1;\n",
      },
    });
    expect(() => validateProdMigrations(dir)).toThrow(/path do CLI/);
    expect(() => validateProdMigrations(dir)).toThrow(/job_ingestions_source_contract_prod/);
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

  it("falha se homolog-only permanecer na raiz que o CLI aplica", () => {
    const dir = writeTempMigrations({
      manifest: ["ok.sql"],
      files: {
        "ok.sql": "select 1;\n",
        "20260920030000_staff_cannot_apply_homolog.sql": "select 1;\n",
      },
    });
    expect(() => validateProdMigrations(dir)).toThrow(/path do CLI/);
    expect(() => validateProdMigrations(dir)).toThrow(/staff_cannot_apply_homolog/);
  });

  it("falha se a subpasta homolog tiver SQL sem marcador homolog-only", () => {
    const dir = writeTempMigrations({
      manifest: ["ok.sql"],
      files: { "ok.sql": "select 1;\n" },
      homologFiles: { "plain.sql": "select 1;\n" },
    });
    expect(() => validateProdMigrations(dir)).toThrow(/sem marcador homolog-only/);
    expect(() => validateProdMigrations(dir)).toThrow(/plain\.sql/);
  });

  it("falha se houver migration sem classificação", () => {
    const dir = writeTempMigrations({
      manifest: ["ok.sql"],
      files: {
        "ok.sql": "select 1;\n",
        "orphan.sql": "select 1;\n",
      },
    });
    expect(() => validateProdMigrations(dir)).toThrow(/path do CLI/);
    expect(() => validateProdMigrations(dir)).toThrow(/orphan\.sql/);
  });

  it("falha se held/ tiver SQL sem marker de Camada B", () => {
    const dir = writeTempMigrations({
      manifest: ["ok.sql"],
      files: { "ok.sql": "select 1;\n" },
      heldFiles: { "plain.sql": "select 1;\n" },
    });
    expect(() => validateProdMigrations(dir)).toThrow(/sem classificação/);
    expect(() => validateProdMigrations(dir)).toThrow(/plain\.sql/);
  });

  it("aceita migration fora do manifesto só quando marcada para não aplicar", () => {
    const dir = writeTempMigrations({
      manifest: ["ok.sql"],
      files: { "ok.sql": "select 1;\n" },
      heldFiles: {
        "pending.sql": "-- Produção: não aplicar (Camada B / PO).\nselect 1;\n",
      },
    });
    const { prod, camadaB } = validateProdMigrations(dir);
    expect(prod).toEqual(["ok.sql"]);
    expect(camadaB).toEqual(["pending.sql"]);
  });

  it("recusa apply quando a URL aponta para produção", () => {
    const homolog = { homologProjectRef: OFFICIAL_HOMOLOG_PROJECT_REF };
    const homologUrl = `postgresql://postgres.${OFFICIAL_HOMOLOG_PROJECT_REF}:pw@db.${OFFICIAL_HOMOLOG_PROJECT_REF}.supabase.co:5432/postgres`;
    const prodUrl = `postgresql://postgres.${OFFICIAL_PROD_PROJECT_REF}:pw@db.${OFFICIAL_PROD_PROJECT_REF}.supabase.co:5432/postgres`;
    expect(() => assertHomologDatabaseUrl("")).toThrow(/ausente/);
    expect(() =>
      assertHomologDatabaseUrl(prodUrl, { homologProjectRef: "" }),
    ).toThrow(/fail-closed/);
    expect(() =>
      assertHomologDatabaseUrl(prodUrl, { homologProjectRef: OFFICIAL_PROD_PROJECT_REF }),
    ).toThrow(/não é o project ref oficial/);
    expect(() => assertHomologDatabaseUrl(prodUrl, homolog)).toThrow(/produção/);
    expect(() =>
      assertHomologDatabaseUrl(`postgresql://postgres.gdg-jobs-prod:pw@db.${OFFICIAL_HOMOLOG_PROJECT_REF}.supabase.co:5432/postgres`, homolog),
    ).toThrow(/produção/);
    expect(() =>
      assertHomologDatabaseUrl(homologUrl, { ...homolog, prodProjectRef: OFFICIAL_HOMOLOG_PROJECT_REF }),
    ).toThrow(/project ref de produção/);
    expect(() =>
      assertHomologDatabaseUrl("postgresql://postgres:pw@127.0.0.1:5432/postgres", homolog),
    ).toThrow(/project ref/);
    expect(() => assertHomologDatabaseUrl(homologUrl, homolog)).not.toThrow();
  });

  it("aplica a cadeia de homologação em ordem sem executar SQL de produção", () => {
    const dir = writeTempMigrations({
      manifest: ["202608150001_ok.sql"],
      files: { "202608150001_ok.sql": "select 1;\n" },
      heldFiles: {
        "20260816000999_held.sql": "-- Produção: não aplicar (Camada B / PO).\nselect 1;\n",
      },
    });
    const calls = [];
    const homologUrl = "postgresql://postgres.pcdfxnfhgdmzmcmlhxuv:secret-pass@db.pcdfxnfhgdmzmcmlhxuv.supabase.co:5432/postgres";
    const gate = { homologProjectRef: "pcdfxnfhgdmzmcmlhxuv", appliedVersions: [] };
    const { ran, skipped } = applyHomologChain(homologUrl, {
      ...gate,
      dir,
      runFile: (_url, file) => calls.push(file),
    });
    expect(ran).toEqual([
      "202608150001_ok.sql",
      "202608160002_seed_fictitious_catalog.sql",
      "20260816000999_held.sql",
    ]);
    expect(skipped).toEqual([]);
    expect(calls).toHaveLength(3);
    const resumed = applyHomologChain(homologUrl, {
      ...gate,
      dir,
      appliedVersions: ["202608150001", "202608160002"],
      runFile: (_url, file) => calls.push(file),
    });
    expect(resumed.skipped).toEqual(["202608150001_ok.sql", "202608160002_seed_fictitious_catalog.sql"]);
    expect(resumed.ran).toEqual(["20260816000999_held.sql"]);
    expect(calls).toHaveLength(4);
    expect(() =>
      applyHomologChain("postgresql://postgres.gdg-jobs-prod:pw@db.example:5432/postgres", {
        ...gate,
        dir,
        runFile: () => calls.push("should-not-run"),
      }),
    ).toThrow(/produção/);
    expect(calls).toHaveLength(4);
  });

  it("plano separa skip, registro de carimbo e SQL legado sem would-apply", () => {
    const repairVersions = new Set(HOMOLOG_HISTORY_REPAIRS.map((row) => row.version));
    const applied = resolveHomologChain()
      .map((item) => migrationVersion(item.name))
      .filter((version) => !repairVersions.has(version));
    const plan = planHomologApply(undefined, applied);
    expect(plan.wouldApply).toEqual([]);
    expect(plan.blockedLegacy).toEqual(["20260909003920_apply_rate_limit.sql"]);
    expect(plan.wouldRegister).toHaveLength(HOMOLOG_HISTORY_REPAIRS.length - 1);
    expect(plan.wouldSkip).toContain("202608150001_ai_matching.sql");
  });

  it("apply não reexecuta SQL com public.is_admin()", () => {
    const dir = writeTempMigrations({
      manifest: ["202608150001_ok.sql"],
      files: { "202608150001_ok.sql": "select 1;\n" },
      homologFiles: {
        "20260815000000_legacy_homolog.sql": "select public.is_admin();\n",
      },
    });
    const calls = [];
    expect(() =>
      applyHomologChain("postgresql://postgres.pcdfxnfhgdmzmcmlhxuv:secret-pass@db.pcdfxnfhgdmzmcmlhxuv.supabase.co:5432/postgres", {
        homologProjectRef: "pcdfxnfhgdmzmcmlhxuv",
        appliedVersions: [],
        dir,
        runFile: () => calls.push("ran"),
      }),
    ).toThrow(/Sem reexecução/);
    expect(calls).toEqual([]);
  });

  it("reparo só insere version e não reenvia o SQL legado", () => {
    const queries = [];
    const inserted = repairHomologHistory(
      "postgresql://postgres.pcdfxnfhgdmzmcmlhxuv:secret-pass@db.pcdfxnfhgdmzmcmlhxuv.supabase.co:5432/postgres",
      {
        homologProjectRef: "pcdfxnfhgdmzmcmlhxuv",
        appliedVersions: ["20260909003920", ...HOMOLOG_HISTORY_REPAIRS.map((row) => row.remote)],
        presentObjects: ["private.is_admin", "private.is_admin_aal2"],
        ensureHistory: () => {},
        runQuery: (_url, sql) => queries.push(sql),
      },
    );
    expect(inserted).not.toContain("20260909003920");
    expect(queries.length).toBe(HOMOLOG_HISTORY_REPAIRS.length - 1);
    expect(queries.every((sql) => sql.startsWith("INSERT INTO supabase_migrations.schema_migrations"))).toBe(true);
    expect(queries.some((sql) => sql.includes("public.is_admin"))).toBe(false);
  });

  it("reparo aborta se o carimbo remoto ou o helper private não existe", () => {
    const queries = [];
    const url = "postgresql://postgres.pcdfxnfhgdmzmcmlhxuv:secret-pass@db.pcdfxnfhgdmzmcmlhxuv.supabase.co:5432/postgres";
    const base = {
      homologProjectRef: "pcdfxnfhgdmzmcmlhxuv",
      ensureHistory: () => {},
      runQuery: (_url, sql) => queries.push(sql),
    };
    expect(() =>
      repairHomologHistory(url, { ...base, appliedVersions: [], presentObjects: ["private.is_admin", "private.is_admin_aal2"] }),
    ).toThrow(/carimbo remoto ausente/);
    expect(() =>
      repairHomologHistory(url, {
        ...base,
        appliedVersions: HOMOLOG_HISTORY_REPAIRS.map((row) => row.remote),
        presentObjects: ["private.is_admin", "private.is_admin_aal2", "public.is_admin"],
      }),
    ).toThrow(/public\.is_admin ainda existe/);
    expect(queries).toEqual([]);
  });

  it("não coloca a senha na linha de comando e grava a versão na mesma transação", () => {
    const invocation = psqlInvocation(
      "postgresql://postgres.pcdfxnfhgdmzmcmlhxuv:secret-pass@db.pcdfxnfhgdmzmcmlhxuv.supabase.co:5432/postgres",
      "C:\\migrations\\202608150001_ok.sql",
      { version: "202608150001", name: "202608150001_ok.sql" },
    );
    expect(invocation.args.join(" ")).not.toContain("secret-pass");
    expect(invocation.env.PGPASSWORD).toBe("secret-pass");
    expect(invocation.input).toContain("BEGIN;");
    expect(invocation.input).toContain("COMMIT;");
    expect(invocation.input).toContain("supabase_migrations.schema_migrations");
    expect(invocation.input).toContain("202608150001");
  });
});
