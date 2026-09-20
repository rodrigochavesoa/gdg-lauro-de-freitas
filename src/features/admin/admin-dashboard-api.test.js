import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseState = vi.hoisted(() => ({
  counts: { pending: 2, approved: 5, rejected: 1 },
  ingestRows: [],
}));

vi.mock("../../lib/supabase-client.js", () => ({
  getSupabaseBrowserClient: () => ({
    from(table) {
      if (table === "jobs") {
        return {
          select() {
            const chain = {
              eq(_col, status) {
                return Promise.resolve({
                  count: supabaseState.counts[status] ?? 0,
                  error: null,
                });
              },
            };
            return chain;
          },
        };
      }
      if (table === "job_ingestions") {
        return {
          select() {
            return Promise.resolve({ data: supabaseState.ingestRows, error: null });
          },
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    },
  }),
}));

import { loadAdminDashboardSummary } from "./admin-dashboard-api.js";

describe("admin-dashboard-api", () => {
  beforeEach(() => {
    supabaseState.counts = { pending: 2, approved: 5, rejected: 1 };
    supabaseState.ingestRows = [];
  });

  it("curator carrega só contagem de pendentes", async () => {
    const summary = await loadAdminDashboardSummary({ isAdmin: false });
    expect(summary.pendingCuration).toBe(2);
    expect(summary.approved).toBe(0);
    expect(summary.ingestAttention).toBe(0);
  });

  it("admin paraleliza contagens sem listas completas", async () => {
    supabaseState.ingestRows = [{ id: "i1", job_id: null, job_ingestion_attempts: [] }];
    const summary = await loadAdminDashboardSummary({ isAdmin: true });
    expect(summary.approved).toBe(5);
    expect(summary.rejectedQueue).toBe(1);
    expect(summary.ingestAttention).toBe(1);
  });
});
