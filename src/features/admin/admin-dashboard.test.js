import { describe, expect, it } from "vitest";
import { ingestNeedsAttention, summarizeAdminDashboard } from "./admin-dashboard.js";

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

  it("só sugere CTA de curadoria quando há fila", () => {
    const empty = summarizeAdminDashboard({ queue: [], isAdmin: false });
    expect(empty.ctas).toEqual([]);
    const withQueue = summarizeAdminDashboard({ queue: [{ id: "1" }, { id: "2" }], isAdmin: false });
    expect(withQueue.ctas).toEqual([{ to: "/admin/curadoria", label: "Revisar curadoria (2)" }]);
  });

  it("admin inclui métricas extras e CTA de ingestão", () => {
    const summary = summarizeAdminDashboard({
      queue: [],
      jobs: [{ status: "approved" }, { status: "pending" }],
      ingestions: [{ job_id: null, job_ingestion_attempts: [] }],
      isAdmin: true,
    });
    expect(summary.metrics.some((m) => m.id === "ingest-attention" && m.label === "Ingestões pendentes" && m.value === 1)).toBe(true);
    expect(summary.ctas.some((c) => c.to === "/admin/ingestao")).toBe(true);
  });
});
