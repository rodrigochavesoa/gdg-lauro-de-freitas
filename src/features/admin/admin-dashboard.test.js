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
});
