import { describe, expect, it, vi } from "vitest";
import {
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

function createIngestionClient({ insertError = null, insertData = null, existingData = null } = {}) {
  const insert = vi.fn(async () => ({
    data: insertData,
    error: insertError,
  }));
  const selectEq = vi.fn(() => ({
    eq: selectEq,
    single: async () => ({ data: existingData, error: existingData ? null : { message: "not found" } }),
  }));
  return {
    from: vi.fn(() => ({
      insert: (row) => ({
        select: () => ({
          single: () => insert(row),
        }),
      }),
      select: () => ({
        eq: selectEq,
      }),
    })),
    insert,
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
  it("devolve a linha existente no conflito 23505 sem criar jobs", async () => {
    const existing = {
      id: "c0ffeeee-0001-4000-8000-000000000001",
      source_kind: SOURCE_KINDS.MANUAL_FIXTURE,
      normalized_locator: "fixture:acme-front",
      payload_hash: "a".repeat(64),
      job_id: null,
      expires_at: null,
    };
    const client = createIngestionClient({
      insertError: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "job_ingestions_source_fingerprint_key"',
      },
      existingData: existing,
    });
    const result = await registerJobIngestion(client, {
      sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
      locator: "fixture:acme-front",
      payload: BASE_PAYLOAD,
    });
    expect(result.idempotent).toBe(true);
    expect(result.id).toBe(existing.id);
    expect(client.from).toHaveBeenCalledWith("job_ingestions");
  });

  it("marca idempotent false na primeira inserção", async () => {
    const created = {
      id: "c0ffeeee-0002-4000-8000-000000000002",
      source_kind: SOURCE_KINDS.MANUAL_FIXTURE,
      normalized_locator: "fixture:acme-front",
    };
    const client = createIngestionClient({ insertData: created });
    const result = await registerJobIngestion(client, {
      sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
      locator: "Fixture:Acme-Front",
      payload: BASE_PAYLOAD,
    });
    expect(result.idempotent).toBe(false);
    expect(result.id).toBe(created.id);
  });

  it("não trata 23505 de outra constraint como duplicata 013", async () => {
    const client = createIngestionClient({
      insertError: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "jobs_company_normalized_title_uidx"',
      },
    });
    await expect(
      registerJobIngestion(client, {
        sourceKind: SOURCE_KINDS.MANUAL_FIXTURE,
        locator: "fixture:acme-front",
        payload: BASE_PAYLOAD,
      }),
    ).rejects.toThrow(/jobs_company_normalized_title_uidx/);
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
