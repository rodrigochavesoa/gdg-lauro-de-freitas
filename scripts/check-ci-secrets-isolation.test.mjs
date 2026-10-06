import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOWS_DIR = join(ROOT, ".github/workflows");
const RULESET = JSON.parse(
  readFileSync(join(ROOT, ".github/branch-protection-main.ruleset.json"), "utf8"),
);

const PRIVILEGED_SECRETS = new Set([
  "SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_TEST_PASSWORD",
  "CURATOR_TEST_PASSWORD",
  "CURATOR2_TEST_PASSWORD",
  "CURATOR3_TEST_PASSWORD",
  "MODERATOR_TEST_PASSWORD",
  "CANDIDATE_TEST_PASSWORD",
]);

const PRIVILEGED_JOB_ID = "rls";
const PRIVILEGED_ENVIRONMENT = "homolog-rls";
const SECRET_BINDING_RE = /\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/g;

function readText(path) {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

function withoutComments(yaml) {
  return yaml.replace(/^\s*#.*$/gm, "");
}

function secretBindings(text) {
  const names = new Set();
  for (const match of text.matchAll(SECRET_BINDING_RE)) {
    names.add(match[1]);
  }
  return names;
}

function privilegedBindings(text) {
  return [...secretBindings(text)].filter((name) => PRIVILEGED_SECRETS.has(name));
}

function workflowSections(yaml) {
  const normalized = withoutComments(yaml);
  const jobsIndex = normalized.search(/^jobs:\s*$/m);
  const preamble = jobsIndex >= 0 ? normalized.slice(0, jobsIndex) : normalized;
  const jobsBody = jobsIndex >= 0 ? normalized.slice(jobsIndex) : "";
  return { preamble, jobsBody };
}

function listJobIds(jobsBody) {
  return [...jobsBody.matchAll(/^ {2}([a-zA-Z0-9_-]+):\s*$/gm)].map((match) => match[1]);
}

function jobBlock(jobsBody, jobId) {
  const lines = jobsBody.split("\n");
  const start = lines.findIndex((line) => line === `  ${jobId}:`);
  if (start < 0) {
    return "";
  }
  let end = start + 1;
  while (end < lines.length && !/^ {2}[A-Za-z0-9_-]+:\s*$/.test(lines[end])) {
    end += 1;
  }
  return lines.slice(start, end).join("\n");
}

function listWorkflowFiles() {
  return readdirSync(WORKFLOWS_DIR).filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"));
}

describe("CI secrets isolation (SEC-CI-SECRETS-01)", () => {
  const workflowFiles = listWorkflowFiles();

  it("há workflows versionados para auditar", () => {
    expect(workflowFiles.length).toBeGreaterThan(0);
  });

  for (const fileName of workflowFiles) {
    const path = join(WORKFLOWS_DIR, fileName);
    const source = readText(path);
    const { preamble, jobsBody } = workflowSections(source);

    describe(fileName, () => {
      it("não usa pull_request_target", () => {
        expect(withoutComments(source)).not.toMatch(/pull_request_target/);
      });

      it("não referencia secrets privilegiados no nível do workflow (antes de jobs:)", () => {
        expect(privilegedBindings(preamble), preamble).toEqual([]);
      });

      it("só o job rls pode referenciar secrets privilegiados", () => {
        for (const jobId of listJobIds(jobsBody)) {
          const block = jobBlock(jobsBody, jobId);
          const privileged = privilegedBindings(block);
          if (jobId === PRIVILEGED_JOB_ID) {
            expect(privileged.length).toBeGreaterThan(0);
            continue;
          }
          expect(privileged, `job ${jobId}`).toEqual([]);
        }
      });

      it("jobs que não são rls não usam o environment homolog-rls", () => {
        for (const jobId of listJobIds(jobsBody)) {
          if (jobId === PRIVILEGED_JOB_ID) {
            continue;
          }
          const block = jobBlock(jobsBody, jobId);
          expect(block, jobId).not.toMatch(/environment:\s*homolog-rls/);
        }
      });

      if (fileName === "ci.yml") {
        it("job rls exige main + push/workflow_dispatch e environment homolog-rls", () => {
          const rls = withoutComments(jobBlock(jobsBody, PRIVILEGED_JOB_ID));
          expect(rls).toContain("name: RLS homolog");
          expect(rls).toMatch(/environment:\s*homolog-rls/);
          expect(rls).toContain("github.ref == 'refs/heads/main'");
          expect(rls).toContain("github.event_name == 'push'");
          expect(rls).toContain("github.event_name == 'workflow_dispatch'");
          expect(rls).not.toMatch(/pull_request/);
        });

        it("job quality roda na PR sem bindings de secrets", () => {
          const quality = jobBlock(jobsBody, "quality");
          expect(quality).toContain("name: Lint, test and build");
          expect(secretBindings(quality)).toEqual(new Set());
          expect(privilegedBindings(quality)).toEqual([]);
        });

        it("job rls isola secrets no step RLS (homologação) e fixa actions por SHA com comentário de versão (SEC-CI-RLS-ENV-01)", () => {
          const rlsRaw = jobBlock(source, PRIVILEGED_JOB_ID);
          const stepsIndex = rlsRaw.search(/^ {4}steps:\s*$/m);
          expect(stepsIndex).toBeGreaterThan(0);

          // Nível de job (antes de steps:) não tem bloco env nem secrets
          const jobLevelHeader = rlsRaw.slice(0, stepsIndex);
          expect(jobLevelHeader).not.toMatch(/^ {4}env:\s*$/m);
          expect(privilegedBindings(jobLevelHeader)).toEqual([]);

          // Actions do job rls devem ser fixadas por 40 hex com comentário de versão
          const actionRegex = /^ {8}uses:\s*([^@\s]+)@([0-9a-f]{40})\s*#\s*(v[0-9.]+)/gm;
          const pinnedActions = [...rlsRaw.matchAll(actionRegex)].map((m) => ({
            action: m[1],
            sha: m[2],
            version: m[3],
          }));
          expect(pinnedActions).toEqual([
            { action: "actions/checkout", sha: "11bd71901bbe5b1630ceea73d27597364c9af683", version: "v4.2.2" },
            { action: "pnpm/action-setup", sha: "fe02b34f77f8bc703788d5817da081398fad5dd2", version: "v4.0.0" },
            { action: "actions/setup-node", sha: "1d0ff469b7ec7b3cb9d8673fde0c81c44821de2a", version: "v4.2.0" },
          ]);

          // Isola o step Checkout do job rls e valida que persist-credentials: false está dentro de with:
          const checkoutMatch = rlsRaw.match(/- name: Checkout\s*\n([\s\S]*?)(?=\n\s+- name:|$)/);
          expect(checkoutMatch).not.toBeNull();
          const checkoutStep = checkoutMatch[1];
          expect(checkoutStep).toContain("actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683");
          expect(checkoutStep).toMatch(/with:\s*\n\s+persist-credentials:\s*false/);

          // Steps preparatórios (Checkout, Setup pnpm, Setup Node.js, Install dependencies) sem secrets
          const rlsStepIndex = rlsRaw.search(/- name: RLS \(homologação\)/);
          expect(rlsStepIndex).toBeGreaterThan(0);
          const setupSteps = rlsRaw.slice(stepsIndex, rlsStepIndex);
          expect(secretBindings(setupSteps)).toEqual(new Set());

          // Step de teste RLS contém o env com segredos e SUPABASE_SERVICE_ROLE_KEY
          const rlsStep = rlsRaw.slice(rlsStepIndex);
          expect(rlsStep).toContain("SUPABASE_SERVICE_ROLE_KEY");
          expect(privilegedBindings(rlsStep)).toEqual(expect.arrayContaining(["SUPABASE_SERVICE_ROLE_KEY"]));
          expect(rlsStep).toContain("run: pnpm test:rls");
        });
      }
    });
  }

  it("ruleset da PR exige só Lint, test and build", () => {
    const rule = RULESET.rules.find((item) => item.type === "required_status_checks");
    const contexts = rule.parameters.required_status_checks.map((item) => item.context);
    expect(contexts).toEqual(["Lint, test and build"]);
  });
});
