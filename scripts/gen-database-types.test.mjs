import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SUPABASE_CLI_VERSION,
  buildTypegenSpawn,
  databaseUrlWithoutPassword,
  resolveSupabaseCliBinary,
} from "./gen-database-types.mjs";

const PASSWORD = "p@ss w&whoami;|'\"";
const DB_URL = `postgresql://postgres.pcdfxnfhgdmzmcmlhxuv:${encodeURIComponent(PASSWORD)}@db.pcdfxnfhgdmzmcmlhxuv.supabase.co:5432/postgres`;

describe("gen-database-types", () => {
  it("tira a senha da URL", () => {
    const { connectionUrl, password } = databaseUrlWithoutPassword(DB_URL);
    expect(password).toBe(PASSWORD);
    expect(connectionUrl).toBe(
      "postgresql://postgres.pcdfxnfhgdmzmcmlhxuv@db.pcdfxnfhgdmzmcmlhxuv.supabase.co:5432/postgres",
    );
    expect(connectionUrl).not.toContain(PASSWORD);
    expect(connectionUrl).not.toContain(encodeURIComponent(PASSWORD));
  });

  it("não coloca a senha nos argumentos e não usa shell", () => {
    const previous = process.env.HOMOLOG_DATABASE_URL;
    process.env.HOMOLOG_DATABASE_URL = DB_URL;
    try {
      const spawnSpec = buildTypegenSpawn(DB_URL, { binaryPath: "supabase" });
      expect(spawnSpec.shell).toBe(false);
      expect(spawnSpec.command).toBe("supabase");
      expect(spawnSpec.args).toEqual([
        "gen",
        "types",
        "typescript",
        "--db-url",
        "postgresql://postgres.pcdfxnfhgdmzmcmlhxuv@db.pcdfxnfhgdmzmcmlhxuv.supabase.co:5432/postgres",
        "--schema",
        "public",
      ]);
      expect(JSON.stringify(spawnSpec.args)).not.toContain(PASSWORD);
      expect(spawnSpec.env.PGPASSWORD).toBe(PASSWORD);
      expect(spawnSpec.env.SUPABASE_DB_PASSWORD).toBe(PASSWORD);
      expect(spawnSpec.env.HOMOLOG_DATABASE_URL).toBeUndefined();
      expect(spawnSpec.args.join(" ")).not.toMatch(/npx|--yes/);
    } finally {
      if (previous === undefined) delete process.env.HOMOLOG_DATABASE_URL;
      else process.env.HOMOLOG_DATABASE_URL = previous;
    }
  });

  it("recusa npx no lugar do binário", () => {
    expect(() => buildTypegenSpawn(DB_URL, { binaryPath: "npx" })).toThrow(/binário pinado/);
  });

  it("resolve o binário da CLI pinada", () => {
    const root = process.cwd();
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    expect(pkg.devDependencies.supabase).toBe(SUPABASE_CLI_VERSION);
    const binaryPath = resolveSupabaseCliBinary();
    expect(binaryPath).toMatch(/cli-(windows|linux|darwin)-/);
    expect(binaryPath).not.toMatch(/npx/);
    const source = readFileSync(path.join(root, "scripts", "gen-database-types.mjs"), "utf8");
    expect(source).not.toMatch(/shell:\s*true/);
    expect(source).not.toMatch(/npx --yes/);
  });
});
