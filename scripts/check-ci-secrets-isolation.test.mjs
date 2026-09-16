import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readText(path) {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CI = readText(join(ROOT, ".github/workflows/ci.yml"));
const RULESET = JSON.parse(readText(join(ROOT, ".github/branch-protection-main.ruleset.json")));
const WORKFLOWS_DIR = join(ROOT, ".github/workflows");

const PRIVILEGED_SECRETS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_TEST_PASSWORD",
  "CURATOR_TEST_PASSWORD",
  "CURATOR2_TEST_PASSWORD",
  "CURATOR3_TEST_PASSWORD",
  "MODERATOR_TEST_PASSWORD",
  "CANDIDATE_TEST_PASSWORD",
];

function withoutComments(yaml) {
  return yaml.replace(/^\s*#.*$/gm, "");
}

function jobBlock(yaml, jobId) {
  const lines = yaml.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`  ${jobId}:`));
  if (start < 0) {
    return "";
  }
  let end = start + 1;
  while (end < lines.length && !/^ {2}[A-Za-z0-9_-]+:/.test(lines[end])) {
    end += 1;
  }
  return lines.slice(start, end).join("\n");
}

describe("CI secrets isolation (SEC-CI-SECRETS-01)", () => {
  const quality = jobBlock(CI, "quality");
  const rls = withoutComments(jobBlock(CI, "rls"));

  it("nenhum workflow usa pull_request_target", () => {
    const files = readdirSync(WORKFLOWS_DIR).filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"));
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      const source = withoutComments(readText(join(WORKFLOWS_DIR, name)));
      expect(source, name).not.toMatch(/pull_request_target/);
    }
  });

  it("job quality não referencia secrets privilegiados", () => {
    expect(quality).toContain("name: Lint, test and build");
    for (const secret of PRIVILEGED_SECRETS) {
      expect(quality, secret).not.toContain(secret);
    }
  });

  it("job rls só em push ou workflow_dispatch na main, com environment homolog-rls", () => {
    expect(rls).toContain("name: RLS homolog");
    expect(rls).toMatch(/environment:\s*homolog-rls/);
    expect(rls).toContain("github.ref == 'refs/heads/main'");
    expect(rls).toContain("github.event_name == 'push'");
    expect(rls).toContain("github.event_name == 'workflow_dispatch'");
    expect(rls).not.toMatch(/pull_request/);
    for (const secret of PRIVILEGED_SECRETS) {
      expect(rls).toContain(secret);
    }
  });

  it("ruleset da PR exige só Lint, test and build", () => {
    const rule = RULESET.rules.find((item) => item.type === "required_status_checks");
    const contexts = rule.parameters.required_status_checks.map((item) => item.context);
    expect(contexts).toEqual(["Lint, test and build"]);
  });
});
