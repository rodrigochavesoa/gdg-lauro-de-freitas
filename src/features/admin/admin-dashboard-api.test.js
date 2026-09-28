import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseState = vi.hoisted(() => ({
  summary: {
    pending_curation: 2,
    pending_jobs: 2,
    approved: 5,
    rejected_jobs: 1,
    rejected_queue: 1,
    ingest_attention: 0,
  },
  rpcs: [],
  selects: [],
  error: null,
}));

vi.mock("../../lib/supabase-client.js", () => ({
  getSupabaseBrowserClient: () => ({
    from(table) {
      return {
        select(columns, options) {
          supabaseState.selects.push({ table, columns, options });
          return { eq: () => Promise.resolve({ count: 0, error: null }) };
        },
      };
    },
    rpc(name) {
      supabaseState.rpcs.push(name);
      return Promise.resolve({ data: supabaseState.error ? null : supabaseState.summary, error: supabaseState.error });
    },
  }),
}));

import { loadAdminDashboardSummary } from "./admin-dashboard-api.js";

describe("admin-dashboard-api", () => {
  beforeEach(() => {
    supabaseState.summary = {
      pending_curation: 2,
      pending_jobs: 2,
      approved: 5,
      rejected_jobs: 1,
      rejected_queue: 1,
      ingest_attention: 0,
    };
    supabaseState.rpcs = [];
    supabaseState.selects = [];
    supabaseState.error = null;
  });

  it("curator zera campos de admin e chama só a RPC de resumo", async () => {
    const summary = await loadAdminDashboardSummary({ isAdmin: false });
    expect(summary.pendingCuration).toBe(2);
    expect(summary.approved).toBe(0);
    expect(summary.rejectedJobs).toBe(0);
    expect(summary.ingestAttention).toBe(0);
    expect(supabaseState.rpcs).toEqual(["get_admin_dashboard_summary"]);
    expect(supabaseState.selects).toEqual([]);
  });

  it("admin lê o resumo numa RPC, sem HEAD em jobs", async () => {
    supabaseState.summary = { ...supabaseState.summary, ingest_attention: 1 };
    const summary = await loadAdminDashboardSummary({ isAdmin: true });
    expect(summary.approved).toBe(5);
    expect(summary.rejectedQueue).toBe(1);
    expect(summary.pendingJobs).toBe(2);
    expect(summary.ingestAttention).toBe(1);
    expect(supabaseState.rpcs).toEqual(["get_admin_dashboard_summary"]);
    expect(supabaseState.selects).toEqual([]);
  });

  it("mapeia aal2 required para o aviso de segundo fator", async () => {
    supabaseState.error = { message: "aal2 required", code: "P0001" };
    await expect(loadAdminDashboardSummary({ isAdmin: true })).rejects.toThrow(/Confirme o segundo fator/);
  });
});
