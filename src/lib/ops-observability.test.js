import { describe, expect, it, vi } from "vitest";
import {
  OPS_ENVIRONMENTS,
  OPS_FLOWS,
  OPS_OUTCOMES,
  buildOpsEvent,
  classifyIngestionResult,
  classifyOpsFailure,
  createCorrelationId,
  emitOpsEvent,
  opsEmissionEnabled,
  resolveOpsEnvironment,
  resolveReleaseSha,
  authoritativeVercelEnv,
  runObserved,
  technicalRoute,
} from "./ops-observability.js";

const POISON = {
  email: "pessoa@example.com",
  password: "hunter2-senha",
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig",
  cv: "curriculo completo da pessoa",
  query: "react salvador senior",
  payload: { description: "texto livre da vaga secreta", cv_url: "https://files.example/cv.pdf?token=abc" },
};

const EVENT_KEYS = [
  "event_name",
  "environment",
  "release_sha",
  "route",
  "action",
  "outcome",
  "error_class",
  "correlation_id",
  "occurred_at",
];

function assertNoPoison(value) {
  const json = JSON.stringify(value);
  expect(json).not.toMatch(/pessoa@example\.com|hunter2|eyJ|curriculo|react salvador|texto livre|cv\.pdf/i);
  expect(json).not.toMatch(/password|bearer |api_key/i);
}

describe("contrato operacional MVP-014", () => {
  it("separa os cinco fluxos, outcomes e ambientes", () => {
    expect(OPS_FLOWS).toEqual(["login", "search", "application", "ingestion", "rpc"]);
    expect(OPS_OUTCOMES).toEqual(["success", "failure", "blocked", "rate_limited"]);
    expect(OPS_ENVIRONMENTS).toEqual(["local", "homolog", "ci", "preview"]);
    const names = OPS_FLOWS.map((flow) => buildOpsEvent({ flow, action: "catalog_search", route: "/vagas", outcome: "success", error_class: "none" }, {}).event_name);
    expect(new Set(names).size).toBe(5);
  });

  it("resolve ambiente e SHA curto sem inventar produção", () => {
    expect(resolveOpsEnvironment({})).toBe("local");
    expect(resolveOpsEnvironment({ VITE_OPS_ENVIRONMENT: "homolog" })).toBe("homolog");
    expect(resolveOpsEnvironment({ MODE: "test" })).toBe("ci");
    expect(resolveOpsEnvironment({ VITE_VERCEL_ENV: "preview" })).toBe("preview");
    expect(resolveOpsEnvironment({ VITE_VERCEL_ENV: "production" })).toBe("local");
    expect(resolveReleaseSha({})).toBeNull();
    expect(resolveReleaseSha({ VITE_RELEASE_SHA: `18f320b${"a".repeat(33)}` })).toBe("18f320b");
    expect(resolveReleaseSha({ VITE_RELEASE_SHA: "not-a-sha" })).toBeNull();
    expect(opsEmissionEnabled({ VITE_VERCEL_ENV: "production" })).toBe(false);
    expect(opsEmissionEnabled({ VITE_VERCEL_ENV: "preview" })).toBe(true);
    expect(opsEmissionEnabled({ MODE: "test" })).toBe(false);
    expect(opsEmissionEnabled({ MODE: "test", VITE_OPS_EMIT: "true" })).toBe(true);
    expect(opsEmissionEnabled({ MODE: "test", VITE_OPS_EMIT: "true", VITE_VERCEL_ENV: "production" })).toBe(false);
    expect(authoritativeVercelEnv("production", "")).toBe("production");
    expect(authoritativeVercelEnv("preview", "preview")).toBe("preview");
    expect(authoritativeVercelEnv("development", "")).toBe("");
    expect(authoritativeVercelEnv("", "production")).toBe("");
    expect(() => authoritativeVercelEnv("production", "preview")).toThrow(/conflita com VERCEL_ENV=production/);
    expect(() => authoritativeVercelEnv("staging", "")).toThrow(/VERCEL_ENV inválido/);
  });

  it("correlation id é técnico e não carrega identidade", () => {
    const first = createCorrelationId(() => "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    const second = createCorrelationId(() => "11111111-2222-3333-4444-555555555555");
    expect(first).toBe("aaaaaaaabbbb");
    expect(second).not.toBe(first);
    expect(first).not.toContain("pessoa");
    expect(technicalRoute("/jobs/11111111-2222-3333-4444-555555555555?email=pessoa@example.com")).toBe("/jobs/:id");
    expect(technicalRoute("pessoa@example.com")).toBe("unknown");
  });

  it("redige e-mail, CV, JWT, senha, token, query e payload", () => {
    const sink = { info: vi.fn() };
    const event = emitOpsEvent(
      {
        flow: "login",
        action: `${POISON.email} password=${POISON.password}`,
        route: `/login?token=${POISON.token}&q=${POISON.query}`,
        outcome: "failure",
        error_class: "auth_invalid",
        correlation_id: POISON.email,
        ...POISON,
        env: { VITE_OPS_ENVIRONMENT: "homolog", VITE_RELEASE_SHA: "18f320b" },
      },
      sink,
    );
    expect(Object.keys(event)).toEqual(EVENT_KEYS);
    expect(event).toMatchObject({
      event_name: "ops.login",
      environment: "homolog",
      release_sha: "18f320b",
      route: "unknown",
      action: "unknown",
      outcome: "failure",
      error_class: "auth_invalid",
    });
    expect(event.correlation_id).toMatch(/^[a-f0-9]{12}$/);
    expect(event.correlation_id).not.toContain("@");
    assertNoPoison(event);
    assertNoPoison(sink.info.mock.calls);
  });

  it("classifica falha de login, busca, candidatura, ingestão e RPC", () => {
    expect(classifyOpsFailure("login", { message: "Invalid login credentials" })).toEqual({
      outcome: "failure",
      error_class: "auth_invalid",
    });
    expect(classifyOpsFailure("login", { message: "Esta conta não tem permissão de curadoria." })).toEqual({
      outcome: "blocked",
      error_class: "auth_forbidden",
    });
    expect(classifyOpsFailure("login", { message: "Failed to fetch" })).toEqual({
      outcome: "failure",
      error_class: "auth_unavailable",
    });
    expect(
      classifyOpsFailure("login", {
        message: "Não foi possível completar a operação. Tente de novo ou contate a equipe.",
        cause: { message: "Failed to fetch" },
      }),
    ).toEqual({
      outcome: "failure",
      error_class: "auth_unavailable",
    });
    expect(classifyOpsFailure("search", { message: "Failed to fetch" })).toEqual({
      outcome: "failure",
      error_class: "search_unavailable",
    });
    expect(classifyOpsFailure("search", { code: "PGRST116", message: "0 rows" })).toEqual({
      outcome: "failure",
      error_class: "search_rejected",
    });
    expect(classifyOpsFailure("application", { code: "already applied", message: POISON.cv })).toEqual({
      outcome: "blocked",
      error_class: "apply_duplicate",
    });
    expect(classifyOpsFailure("application", { message: "VITE_SUPABASE_URL e chave publishable/anon não configuradas." })).toEqual({
      outcome: "failure",
      error_class: "client_unconfigured",
    });
    expect(classifyOpsFailure("ingestion", { code: "23505", message: "duplicate key fingerprint" })).toEqual({
      outcome: "blocked",
      error_class: "ingest_duplicate",
    });
    expect(classifyOpsFailure("ingestion", { message: "localizador URL inválido." })).toEqual({
      outcome: "failure",
      error_class: "ingest_invalid",
    });
    expect(classifyOpsFailure("rpc", { message: "Confirme o segundo fator na tela anterior." })).toEqual({
      outcome: "blocked",
      error_class: "rpc_forbidden",
    });
    expect(classifyOpsFailure("rpc", { message: "could not find the function" })).toEqual({
      outcome: "failure",
      error_class: "rpc_unavailable",
    });
    expect(classifyIngestionResult({ outcome: "materialized" })).toEqual({ outcome: "success", error_class: "none" });
    expect(classifyIngestionResult({ outcome: "expired", failure_detail: POISON.payload.description })).toEqual({
      outcome: "blocked",
      error_class: "ingest_expired",
    });
    expect(classifyIngestionResult({ outcome: "failed", failure_code: "payload_invalid", failure_detail: POISON.cv })).toEqual({
      outcome: "failure",
      error_class: "ingest_invalid",
    });
  });

  it("rate limit não vaza credencial no evento", () => {
    const sink = { info: vi.fn() };
    const error = {
      code: "rate limit exceeded",
      status: 429,
      message: `rate limit exceeded ${POISON.email} password=${POISON.password} token=${POISON.token} ${POISON.cv}`,
      payload: POISON.payload,
    };
    const event = emitOpsEvent(
      {
        flow: "application",
        action: "apply_to_job",
        route: "/jobs/:id",
        ...classifyOpsFailure("application", error),
        message: error.message,
        payload: error.payload,
        env: { VITE_OPS_ENVIRONMENT: "preview" },
      },
      sink,
    );
    expect(event).toMatchObject({
      event_name: "ops.application",
      environment: "preview",
      outcome: "rate_limited",
      error_class: "rate_limited",
      action: "apply_to_job",
      route: "/jobs/:id",
    });
    assertNoPoison(event);
  });

  it("não persiste o retorno da operação e não emite em produção", async () => {
    const sink = { info: vi.fn() };
    const result = await runObserved(
      { flow: "login", action: "google_oauth", route: "/login", sink, env: { VITE_OPS_ENVIRONMENT: "local" } },
      async () => POISON,
    );
    expect(result.email).toBe(POISON.email);
    expect(sink.info).toHaveBeenCalledTimes(1);
    assertNoPoison(sink.info.mock.calls);

    const silent = { info: vi.fn() };
    const skipped = await runObserved(
      { flow: "rpc", action: "submit_curation_review", route: "/admin/curadoria", sink: silent, env: { VITE_VERCEL_ENV: "production" } },
      async () => "ok",
    );
    expect(skipped).toBe("ok");
    expect(silent.info).not.toHaveBeenCalled();
  });
});
