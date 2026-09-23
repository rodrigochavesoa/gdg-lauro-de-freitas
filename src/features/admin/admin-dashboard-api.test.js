import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseState = vi.hoisted(() => ({
  counts: { pending: 2, approved: 5, rejected: 1 },
  ingestAttention: 0,
  selects: [],
  rpcs: [],
}));

vi.mock("../../lib/supabase-client.js", () => ({
  getSupabaseBrowserClient: () => ({
    from(table) {
      if (table === "jobs") {
        return {
          select(columns, options) {
            supabaseState.selects.push({ table, columns, options });
            return {
              eq(_col, status) {
                return Promise.resolve({
                  count: supabaseState.counts[status] ?? 0,
                  error: null,
                });
              },
            };
          },
        };
      }
      return {
        select(columns, options) {
          supabaseState.selects.push({ table, columns, options });
          return Promise.resolve({ data: [], error: null });
        },
      };
    },
    rpc(name) {
      supabaseState.rpcs.push(name);
      return Promise.resolve({ data: supabaseState.ingestAttention, error: null });
    },
  }),
}));

import { countIngestionsNeedingAttention, loadAdminDashboardSummary } from "./admin-dashboard-api.js";

describe("admin-dashboard-api", () => {
  beforeEach(() => {
    supabaseState.counts = { pending: 2, approved: 5, rejected: 1 };
    supabaseState.ingestAttention = 0;
    supabaseState.selects = [];
    supabaseState.rpcs = [];
  });

  it("curator carrega só contagem de pendentes e não conta ingestão", async () => {
    const summary = await loadAdminDashboardSummary({ isAdmin: false });
    expect(summary.pendingCuration).toBe(2);
    expect(summary.approved).toBe(0);
    expect(summary.ingestAttention).toBe(0);
    expect(supabaseState.rpcs).toEqual([]);
    expect(supabaseState.selects.some((call) => call.table === "job_ingestions")).toBe(false);
  });

  it("admin conta vagas em paralelo e ingestão no servidor, sem baixar a lista", async () => {
    supabaseState.ingestAttention = 1;
    const summary = await loadAdminDashboardSummary({ isAdmin: true });
    expect(summary.approved).toBe(5);
    expect(summary.rejectedQueue).toBe(1);
    expect(summary.ingestAttention).toBe(1);
    expect(supabaseState.rpcs).toEqual(["count_job_ingestions_needing_attention"]);
    expect(supabaseState.selects.filter((call) => call.table === "jobs")).toHaveLength(3);
    expect(supabaseState.selects.every((call) => call.options?.head === true && call.options?.count === "exact")).toBe(true);
    expect(supabaseState.selects.some((call) => call.table === "job_ingestions")).toBe(false);
    await expect(countIngestionsNeedingAttention()).resolves.toBe(1);
  });
});
