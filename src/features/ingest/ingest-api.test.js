import { describe, expect, it, vi } from "vitest";
import {
  HOMOLOG_MANUAL_FIXTURE,
  HOMOLOG_STRUCTURED_FIXTURE,
  INGESTION_OUTCOMES,
  INGESTION_PAGE_SIZE,
  PROCESS_JOB_INGESTION_RPC,
  describeIngestionOutcome,
  latestIngestionAttempt,
  loadJobIngestionDetail,
  loadJobIngestions,
  mapIngestionListRow,
  processJobIngestion,
} from "./ingest-api.js";
import { SOURCE_KINDS, canonicalizeIngestionPayload } from "./source-contract.js";

function createRpcClient({ data = null, error = null, query = null } = {}) {
  return {
    rpc: vi.fn(async () => ({ data, error })),
    from: vi.fn(() => query),
  };
}

describe("fixtures homolog", () => {
  it("a fixture antiga não traz país nem faixa; a estruturada traz os dois explícitos", () => {
    expect(HOMOLOG_MANUAL_FIXTURE.payload).not.toHaveProperty("country_code");
    expect(HOMOLOG_MANUAL_FIXTURE.payload.location).toMatch(/Brasil/);
    const canonical = canonicalizeIngestionPayload(HOMOLOG_STRUCTURED_FIXTURE.payload);
    expect(canonical).toContain('"country_code":"BR"');
    expect(canonical).toContain('"salary_min":800000');
    expect(canonical).toContain('"salary_max":1200000');
    expect(canonical).toContain("Salvador");
  });
});

describe("processJobIngestion", () => {
  it("envia payload à RPC de processo e não escolhe approved nem hash", async () => {
    const data = {
      ingestion: { id: "ing-1", job_id: "job-1" },
      job: { id: "job-1", title: HOMOLOG_MANUAL_FIXTURE.payload.title, status: "pending" },
      outcome: INGESTION_OUTCOMES.MATERIALIZED,
      idempotent: false,
    };
    const client = createRpcClient({ data });
    const result = await processJobIngestion(client, HOMOLOG_MANUAL_FIXTURE);
    expect(result.job.status).toBe("pending");
    expect(result.outcome).toBe("materialized");
    expect(client.rpc).toHaveBeenCalledWith(PROCESS_JOB_INGESTION_RPC, {
      p_source_kind: SOURCE_KINDS.MANUAL_FIXTURE,
      p_locator: HOMOLOG_MANUAL_FIXTURE.locator,
      p_payload: HOMOLOG_MANUAL_FIXTURE.payload,
      p_expires_at: null,
    });
    expect(JSON.stringify(client.rpc.mock.calls[0][1])).not.toMatch(/approved|payload_hash/);
  });

  it("repetição idempotente devolve a mesma ingestão", async () => {
    const data = {
      ingestion: { id: "ing-1", job_id: "job-1" },
      job: { id: "job-1", title: "Pessoa Dev", status: "pending" },
      outcome: INGESTION_OUTCOMES.IDEMPOTENT,
      idempotent: true,
    };
    const client = createRpcClient({ data });
    const first = await processJobIngestion(client, HOMOLOG_MANUAL_FIXTURE);
    const second = await processJobIngestion(client, HOMOLOG_MANUAL_FIXTURE);
    expect(second.ingestion.id).toBe(first.ingestion.id);
    expect(second.idempotent).toBe(true);
  });

  it("falha parcial devolve código redigido e não inventa vaga", async () => {
    const data = {
      ingestion: { id: "ing-2", job_id: null },
      job: null,
      outcome: INGESTION_OUTCOMES.FAILED,
      failure_code: "payload_invalid",
      failure_detail: "payload de ingestão exige description, level e work_model para materializar",
    };
    const client = createRpcClient({ data });
    const result = await processJobIngestion(client, {
      ...HOMOLOG_MANUAL_FIXTURE,
      payload: { title: "Dev", company_name: "Empresa Fictícia Lab" },
    });
    expect(result.job).toBeNull();
    expect(result.failure_code).toBe("payload_invalid");
    expect(result.failure_detail).not.toMatch(/@|email|token/i);
  });

  it("evento operacional omite payload, locator e failure_detail", async () => {
    vi.stubEnv("VITE_OPS_EMIT", "true");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const data = {
        ingestion: { id: "ing-2", job_id: null },
        job: null,
        outcome: INGESTION_OUTCOMES.FAILED,
        failure_code: "payload_invalid",
        failure_detail: "curriculo pessoa@example.com",
      };
      const client = createRpcClient({ data });
      await processJobIngestion(client, {
        ...HOMOLOG_MANUAL_FIXTURE,
        locator: "fixture:segredo-pessoa@example.com",
        payload: { title: "Dev", company_name: "Empresa Fictícia Lab", description: "texto livre secreto" },
      });
      const events = info.mock.calls.map((call) => call[0]).filter((entry) => entry?.event_name === "ops.ingestion");
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        action: "process_job_ingestion",
        route: "/admin/ingestao",
        outcome: "failure",
        error_class: "ingest_invalid",
      });
      expect(JSON.stringify(events)).not.toMatch(/pessoa@example.com|curriculo|texto livre|fixture:segredo/);
    } finally {
      info.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});

describe("latestIngestionAttempt e copy", () => {
  it("escolhe a tentativa mais recente e rotula expiração", () => {
    expect(describeIngestionOutcome("expired")).toBe("Expirada");
    const latest = latestIngestionAttempt({
      job_ingestion_attempts: [
        { id: "a", created_at: "2026-09-20T10:00:00.000Z", outcome: "failed" },
        { id: "b", created_at: "2026-09-20T12:00:00.000Z", outcome: "materialized" },
      ],
    });
    expect(latest.id).toBe("b");
  });
});

describe("loadJobIngestions", () => {
  it("lista uma página enxuta, sem payload nem tentativas", async () => {
    const range = vi.fn(async () => ({
      data: [{ id: "ing-1", payload_title: "Dev", latest_outcome: "failed", job_id: null }],
      error: null,
    }));
    const orderId = vi.fn(() => ({ range }));
    const orderCreated = vi.fn(() => ({ order: orderId }));
    const select = vi.fn(() => ({ order: orderCreated }));
    const client = {
      rpc: vi.fn(),
      from: vi.fn(() => ({ select })),
    };
    const page = await loadJobIngestions(client);
    expect(client.from).toHaveBeenCalledWith("job_ingestion_staff_list");
    expect(select.mock.calls[0][0]).not.toMatch(/canonical_payload|job_ingestion_attempts/);
    expect(range).toHaveBeenCalledWith(0, INGESTION_PAGE_SIZE);
    expect(page.items).toEqual([
      mapIngestionListRow({ id: "ing-1", payload_title: "Dev", latest_outcome: "failed", job_id: null }),
    ]);
    expect(page.items[0]).not.toHaveProperty("canonical_payload");
    expect(page.hasNext).toBe(false);
  });

  it("marca hasNext quando volta uma linha além da página", async () => {
    const rows = Array.from({ length: INGESTION_PAGE_SIZE + 1 }, (_, index) => ({ id: `ing-${index}` }));
    const range = vi.fn(async () => ({ data: rows, error: null }));
    const orderId = vi.fn(() => ({ range }));
    const orderCreated = vi.fn(() => ({ order: orderId }));
    const select = vi.fn(() => ({ order: orderCreated }));
    const client = { rpc: vi.fn(), from: vi.fn(() => ({ select })) };
    const page = await loadJobIngestions(client, { page: 2 });
    expect(range).toHaveBeenCalledWith(INGESTION_PAGE_SIZE, INGESTION_PAGE_SIZE * 2);
    expect(page.items).toHaveLength(INGESTION_PAGE_SIZE);
    expect(page.hasNext).toBe(true);
    expect(page.page).toBe(2);
  });
});

describe("loadJobIngestionDetail", () => {
  it("busca payload e tentativas de um registro", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: { id: "ing-1", canonical_payload: { title: "Dev" }, job_ingestion_attempts: [] },
      error: null,
    }));
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const client = { rpc: vi.fn(), from: vi.fn(() => ({ select })) };
    const row = await loadJobIngestionDetail(client, "ing-1");
    expect(client.from).toHaveBeenCalledWith("job_ingestions");
    expect(select.mock.calls[0][0]).toMatch(/canonical_payload/);
    expect(select.mock.calls[0][0]).toMatch(/job_ingestion_attempts/);
    expect(eq).toHaveBeenCalledWith("id", "ing-1");
    expect(row.canonical_payload.title).toBe("Dev");
  });
});
