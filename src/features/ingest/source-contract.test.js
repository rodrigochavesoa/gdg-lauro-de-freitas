import { describe, expect, it, vi } from "vitest";
import { STAFF_API_ERROR_FALLBACK } from "../../lib/staff-api-errors.js";
import {
  REGISTER_JOB_INGESTION_RPC,
  SOURCE_KINDS,
  buildIngestionFingerprint,
  canonicalizeIngestionPayload,
  hashIngestionPayload,
  isIngestionExpired,
  isIngestionUniqueViolation,
  isSameIngestionFingerprint,
  normalizeLocator,
  normalizeUrlLocator,
  pickIngestionPayload,
  registerJobIngestion,
} from "./source-contract.js";

const BASE_PAYLOAD = {
  title: "Pessoa Dev Front-end",
  company_name: "Empresa Fictícia Lab",
  description: "Vaga fictícia de homologação.",
  level: "junior",
  work_model: "remote",
  location: "Brasil · Remoto",
  stack: ["TypeScript", "React"],
};

function createRpcClient({ data = null, error = null } = {}) {
  return {
    rpc: vi.fn(async () => ({ data, error })),
  };
}

describe("normalizeLocator (manual_fixture / staff_replay)", () => {
  it("aplica trim, colapsa espaços e lower", () => {
    expect(normalizeLocator("Manual_Fixture", "  Fixture:Acme   Front  ")).toBe("fixture:acme front");
    expect(normalizeLocator(SOURCE_KINDS.STAFF_REPLAY, "Replay:Cycle-1")).toBe("replay:cycle-1");
  });

  it("rejeita source_kind fora do catálogo da sprint", () => {
    expect(() => normalizeLocator("http_url", "https://example.invalid/jobs/1")).toThrow(/não suportado/);
  });

  it("rejeita localizador vazio", () => {
    expect(() => normalizeLocator(SOURCE_KINDS.MANUAL_FIXTURE, "   ")).toThrow(/vazio/);
  });
});

describe("normalizeUrlLocator (contrato futuro, fora do CHECK atual)", () => {
  it("é estável: host lower, sem fragmento, sem tracking, query ordenada, sem credencial", () => {
    const raw =
      "HTTPS://User:secret@Example.COM:443/jobs/42/?b=2&utm_source=x&a=1#section";
    expect(normalizeUrlLocator(raw)).toBe("https://example.com/jobs/42?a=1&b=2");
  });

  it("remove barra final fora da raiz", () => {
    expect(normalizeUrlLocator("https://example.com/vagas/")).toBe("https://example.com/vagas");
  });
});

describe("fingerprint estável", () => {
  it("produz o mesmo hash com chaves fora de ordem e stack embaralhada", async () => {
    const first = await hashIngestionPayload({
      stack: ["React", "TypeScript"],
      title: "Pessoa Dev Front-end",
      company_name: "Empresa Fictícia Lab",
    });
    const second = await hashIngestionPayload({
      company_name: "Empresa Fictícia Lab",
      title: "Pessoa Dev Front-end",
      stack: ["TypeScript", "React"],
      ignored: "não entra no canônico",
    });
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
  });

  it("omite país e faixa vazios e não infere país da localidade", async () => {
    const plain = await hashIngestionPayload(BASE_PAYLOAD);
    const emptyStructured = await hashIngestionPayload({
      ...BASE_PAYLOAD,
      country_code: "",
      salary_min: null,
      salary_max: "",
    });
    expect(emptyStructured).toBe(plain);
    expect(canonicalizeIngestionPayload(BASE_PAYLOAD)).not.toContain("country_code");
    expect(canonicalizeIngestionPayload({ ...BASE_PAYLOAD, location: "Brasil" })).not.toContain("country_code");
  });

  it("inclui país e centavos no canônico, na ordem das chaves", () => {
    expect(
      canonicalizeIngestionPayload({
        ...BASE_PAYLOAD,
        country_code: "br",
        salary_min: "0800000",
        salary_max: 1200000,
      }),
    ).toBe(
      JSON.stringify({
        company_name: BASE_PAYLOAD.company_name,
        description: BASE_PAYLOAD.description,
        level: "junior",
        location: "Brasil · Remoto",
        stack: ["React", "TypeScript"],
        title: BASE_PAYLOAD.title,
        work_model: "remote",
        country_code: "BR",
        salary_min: 800000,
        salary_max: 1200000,
      }),
    );
  });

  it("recusa país textual, centavos inválidos e mínimo maior que o máximo", () => {
    expect(() => canonicalizeIngestionPayload({ ...BASE_PAYLOAD, country_code: "Brasil" })).toThrow(/country_code/);
    expect(() => canonicalizeIngestionPayload({ ...BASE_PAYLOAD, salary_min: 800000.5 })).toThrow(/salary_min/);
    expect(() =>
      canonicalizeIngestionPayload({ ...BASE_PAYLOAD, salary_min: 1200000, salary_max: 800000 }),
    ).toThrow(/faixa salarial/);
  });

  it("canônico exige title e company_name e recusa PII", () => {
    expect(() => pickIngestionPayload({ title: "Dev" })).toThrow(/company_name/);
    expect(() =>
      canonicalizeIngestionPayload({ ...BASE_PAYLOAD, email: "pessoa@example.invalid" }),
    ).toThrow(/proibidos/);
  });

  it("mesma origem + mesmo payload gera fingerprint idêntico após normalizar locator", async () => {
    const first = await buildIngestionFingerprint({
      sourceKind: "MANUAL_FIXTURE",
      locator: "  Fixture:Acme-Front  ",
      payload: BASE_PAYLOAD,
    });
    const second = await buildIngestionFingerprint({
      sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
      locator: "fixture:acme-front",
      payload: { ...BASE_PAYLOAD, stack: ["React", "TypeScript"] },
    });
    expect(isSameIngestionFingerprint(first, second)).toBe(true);
  });
});

describe("mesma fonte repetida vs fontes distintas", () => {
  it("localizadores distintos geram chaves distintas com o mesmo payload", async () => {
    const first = await buildIngestionFingerprint({
      sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
      locator: "fixture:acme-front",
      payload: BASE_PAYLOAD,
    });
    const second = await buildIngestionFingerprint({
      sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
      locator: "fixture:acme-back",
      payload: BASE_PAYLOAD,
    });
    expect(isSameIngestionFingerprint(first, second)).toBe(false);
    expect(first.payload_hash).toBe(second.payload_hash);
  });

  it("mesmo localizador com payload diferente gera novo fingerprint", async () => {
    const first = await buildIngestionFingerprint({
      sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
      locator: "fixture:acme-front",
      payload: BASE_PAYLOAD,
    });
    const second = await buildIngestionFingerprint({
      sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
      locator: "fixture:acme-front",
      payload: { ...BASE_PAYLOAD, title: "Pessoa Dev Front-end Pleno" },
    });
    expect(first.normalized_locator).toBe(second.normalized_locator);
    expect(first.payload_hash).not.toBe(second.payload_hash);
  });

  it("source_kind distinto não colide mesmo com locator e hash iguais", async () => {
    const fixture = await buildIngestionFingerprint({
      sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
      locator: "cycle-1",
      payload: BASE_PAYLOAD,
    });
    const replay = await buildIngestionFingerprint({
      sourceKind: SOURCE_KINDS.STAFF_REPLAY,
      locator: "cycle-1",
      payload: BASE_PAYLOAD,
    });
    expect(fixture.payload_hash).toBe(replay.payload_hash);
    expect(fixture.normalized_locator).toBe(replay.normalized_locator);
    expect(isSameIngestionFingerprint(fixture, replay)).toBe(false);
  });
});

describe("expiração preserva histórico", () => {
  it("expires_at passado está expirado; nulo não está; registro não é apagado por essa regra", () => {
    const now = new Date("2026-09-19T12:00:00.000Z");
    expect(isIngestionExpired("2026-09-18T00:00:00.000Z", now)).toBe(true);
    expect(isIngestionExpired(null, now)).toBe(false);
    expect(isIngestionExpired("2026-09-20T00:00:00.000Z", now)).toBe(false);
  });
});

describe("registerJobIngestion é idempotente na camada 013", () => {
  it("envia payload cru à RPC e não escolhe payload_hash", async () => {
    const created = {
      id: "c0ffeeee-0002-4000-8000-000000000002",
      source_kind: SOURCE_KINDS.MANUAL_FIXTURE,
      normalized_locator: "fixture:acme-front",
      payload_hash: "c".repeat(64),
      idempotent: false,
    };
    const client = createRpcClient({ data: created });
    const result = await registerJobIngestion(client, {
      sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
      locator: "Fixture:Acme-Front",
      payload: BASE_PAYLOAD,
    });
    expect(result.idempotent).toBe(false);
    expect(result.id).toBe(created.id);
    expect(client.rpc).toHaveBeenCalledWith(REGISTER_JOB_INGESTION_RPC, {
      p_source_kind: SOURCE_KINDS.MANUAL_FIXTURE,
      p_locator: "Fixture:Acme-Front",
      p_payload: BASE_PAYLOAD,
      p_expires_at: null,
      p_job_id: null,
    });
    expect(client.rpc.mock.calls[0][1]).not.toHaveProperty("payload_hash");
    expect(client.rpc.mock.calls[0][1]).not.toHaveProperty("p_payload_hash");
  });

  it("devolve a linha existente quando a RPC marca idempotent", async () => {
    const existing = {
      id: "c0ffeeee-0001-4000-8000-000000000001",
      source_kind: SOURCE_KINDS.MANUAL_FIXTURE,
      normalized_locator: "fixture:acme-front",
      payload_hash: "a".repeat(64),
      job_id: null,
      expires_at: null,
      idempotent: true,
    };
    const client = createRpcClient({ data: existing });
    const result = await registerJobIngestion(client, {
      sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
      locator: "fixture:acme-front",
      payload: BASE_PAYLOAD,
    });
    expect(result.idempotent).toBe(true);
    expect(result.id).toBe(existing.id);
  });

  it("propaga erro da RPC sem ecoar constraint e não trata 23505 de outra tabela como duplicata 013", async () => {
    const client = createRpcClient({
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "jobs_company_normalized_title_uidx"',
      },
    });
    try {
      await registerJobIngestion(client, {
        sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
        locator: "fixture:acme-front",
        payload: BASE_PAYLOAD,
      });
      throw new Error("esperava falha da RPC");
    } catch (error) {
      expect(error.message).toBe(STAFF_API_ERROR_FALLBACK);
      expect(error.message).not.toMatch(/jobs_company_normalized_title_uidx/);
      expect(error.cause?.message).toMatch(/jobs_company_normalized_title_uidx/);
    }
    expect(
      isIngestionUniqueViolation({
        code: "23505",
        message: 'duplicate key value violates unique constraint "jobs_company_normalized_title_uidx"',
      }),
    ).toBe(false);
    expect(
      isIngestionUniqueViolation({
        code: "23505",
        message: 'duplicate key value violates unique constraint "job_ingestions_source_fingerprint_key"',
      }),
    ).toBe(true);
  });
});
