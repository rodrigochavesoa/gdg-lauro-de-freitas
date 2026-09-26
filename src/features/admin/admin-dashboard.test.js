import { describe, expect, it } from "vitest";
import { latestIngestionAttempt } from "../ingest/ingest-api.js";
import { ingestNeedsAttention, staffListRowNeedsAttention, summarizeAdminDashboard } from "./admin-dashboard.js";

describe("admin-dashboard", () => {
  it("marca ingestão sem job e com falha recente como atenção", () => {
    expect(ingestNeedsAttention({ job_id: null, job_ingestion_attempts: [] })).toBe(true);
    expect(
      ingestNeedsAttention({
        job_id: "j1",
        job_ingestion_attempts: [{ outcome: "failed", created_at: "2026-01-01T00:00:00Z" }],
      }),
    ).toBe(true);
    expect(
      ingestNeedsAttention({
        job_id: "j1",
        job_ingestion_attempts: [{ outcome: "materialized", created_at: "2026-01-01T00:00:00Z" }],
      }),
    ).toBe(false);
  });

  // Paridade view/RPC/JS: docs-local/tech/INGEST-ATTENTION-CONTRACT.md
  it("casa o predicado da view com ingestNeedsAttention, inclusive retry idempotente", () => {
    expect(staffListRowNeedsAttention({ job_id: null, latest_outcome: null })).toBe(true);
    expect(staffListRowNeedsAttention({ job_id: null, latest_outcome: "failed" })).toBe(true);
    expect(staffListRowNeedsAttention({ job_id: "j1", latest_outcome: "failed" })).toBe(true);
    expect(staffListRowNeedsAttention({ job_id: "j1", latest_outcome: "expired" })).toBe(true);
    expect(staffListRowNeedsAttention({ job_id: "j1", latest_outcome: "materialized" })).toBe(false);
    expect(staffListRowNeedsAttention({ job_id: "j1", latest_outcome: "idempotent" })).toBe(false);
    expect(staffListRowNeedsAttention({ job_id: "j1", latest_outcome: null })).toBe(false);

    const cases = [
      { job_id: null, job_ingestion_attempts: [] },
      { job_id: "j1", job_ingestion_attempts: [] },
      {
        job_id: null,
        job_ingestion_attempts: [{ id: "b", outcome: "failed", created_at: "2026-01-02T00:00:00Z" }],
      },
      {
        job_id: "j1",
        job_ingestion_attempts: [{ id: "b", outcome: "expired", created_at: "2026-01-02T00:00:00Z" }],
      },
      {
        job_id: "j1",
        job_ingestion_attempts: [{ id: "a", outcome: "materialized", created_at: "2026-01-01T00:00:00Z" }],
      },
      {
        job_id: "j1",
        job_ingestion_attempts: [
          { id: "a", outcome: "materialized", created_at: "2026-01-01T00:00:00Z" },
          { id: "b", outcome: "idempotent", created_at: "2026-01-02T00:00:00Z" },
        ],
      },
    ];

    for (const ingestion of cases) {
      const attempt = latestIngestionAttempt(ingestion);
      const row = { job_id: ingestion.job_id ?? null, latest_outcome: attempt?.outcome ?? null };
      expect(staffListRowNeedsAttention(row)).toBe(ingestNeedsAttention(ingestion));
    }
  });

  it("só sugere CTA de curadoria quando há fila", () => {
    const empty = summarizeAdminDashboard({ isAdmin: false, pendingCuration: 0 });
    expect(empty.ctas).toEqual([]);
    const withQueue = summarizeAdminDashboard({ isAdmin: false, pendingCuration: 2 });
    expect(withQueue.ctas).toEqual([{ to: "/admin/curadoria", label: "Revisar curadoria (2)" }]);
  });

  it("admin inclui métricas extras e CTA de ingestão", () => {
    const summary = summarizeAdminDashboard({
      isAdmin: true,
      pendingCuration: 0,
      approved: 1,
      rejectedJobs: 0,
      rejectedQueue: 0,
      pendingJobs: 0,
      ingestAttention: 1,
    });
    expect(summary.metrics.some((m) => m.id === "ingest-attention" && m.value === 1)).toBe(true);
    expect(summary.ctas.some((c) => c.to === "/admin/ingestao")).toBe(true);
  });

  it("não trata métrica pendente como zero", () => {
    const summary = summarizeAdminDashboard({ isAdmin: true });
    expect(summary.metrics.map((metric) => metric.value)).toEqual([null, null, null, null, null]);
    expect(summary.ctas).toEqual([]);
  });
});
