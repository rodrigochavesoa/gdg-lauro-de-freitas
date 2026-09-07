import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
const fromMock = vi.fn();
const getUserMock = vi.fn();

vi.mock("../../lib/supabase-client.js", () => ({
  getSupabaseBrowserClient: () => ({
    rpc: rpcMock,
    from: fromMock,
    auth: { getUser: getUserMock },
  }),
}));

import {
  applicationStatusLabel,
  applyToJob,
  canWithdrawStatus,
  createApplyError,
  getApplyErrorCode,
  loadMyApplication,
  loadMyApplications,
  parseApplication,
  withdrawApplication,
} from "./apply-api.js";

describe("mapeamento de erros RPC", () => {
  it("lê o código estável em message, details ou hint", () => {
    expect(getApplyErrorCode({ message: "already applied" })).toBe("already applied");
    expect(getApplyErrorCode({ details: "profile incomplete" })).toBe("profile incomplete");
    expect(getApplyErrorCode({ hint: "job is not approved" })).toBe("job is not approved");
    expect(getApplyErrorCode({ message: "P0001", details: "cannot withdraw application" })).toBe(
      "cannot withdraw application",
    );
    expect(getApplyErrorCode({ message: "timeout" })).toBe("unknown");
  });

  it("traduz códigos para copy de UX", () => {
    expect(createApplyError({ message: "authentication required" }).message).toBe("Entre para se candidatar.");
    expect(createApplyError({ message: "profile incomplete" }).code).toBe("profile incomplete");
    expect(createApplyError({ message: "already applied" }).message).toBe("Você já se candidatou a esta vaga.");
    expect(createApplyError({ message: "job is not approved" }).message).toMatch(/não está disponível/);
  });
});

describe("parseApplication e withdraw", () => {
  it("normaliza a resposta da RPC", () => {
    const parsed = parseApplication({
      id: "app-1",
      job_id: "job-1",
      candidate_id: "u1",
      status: "submitted",
      snapshot: { full_name: "Ana" },
    });
    expect(parsed).toMatchObject({
      id: "app-1",
      jobId: "job-1",
      candidateId: "u1",
      status: "submitted",
    });
  });

  it("permite retirar só submitted e reviewing", () => {
    expect(canWithdrawStatus("submitted")).toBe(true);
    expect(canWithdrawStatus("reviewing")).toBe(true);
    expect(canWithdrawStatus("withdrawn")).toBe(false);
    expect(canWithdrawStatus("accepted")).toBe(false);
  });

  it("rótulos PT batem com o detalhe", () => {
    expect(applicationStatusLabel("submitted")).toBe("Enviada");
    expect(applicationStatusLabel("reviewing")).toBe("Em análise");
    expect(applicationStatusLabel("withdrawn")).toBe("Retirada");
  });

  it("parseApplication lê join de jobs e companies", () => {
    const parsed = parseApplication({
      id: "a1",
      job_id: "job-1",
      candidate_id: "u1",
      status: "submitted",
      jobs: { title: "Pessoa Dev", companies: { name: "Nuvem Lauro Demo" } },
    });
    expect(parsed.jobTitle).toBe("Pessoa Dev");
    expect(parsed.companyName).toBe("Nuvem Lauro Demo");
  });
});

describe("RPCs", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    getUserMock.mockReset();
  });

  it("applyToJob chama apply_to_job e devolve a linha", async () => {
    rpcMock.mockResolvedValue({
      data: { id: "a1", job_id: "job-1", candidate_id: "u1", status: "submitted" },
      error: null,
    });
    const row = await applyToJob("job-1");
    expect(rpcMock).toHaveBeenCalledWith("apply_to_job", { p_job_id: "job-1" });
    expect(row.status).toBe("submitted");
  });

  it("applyToJob mapeia already applied", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "already applied" } });
    await expect(applyToJob("job-1")).rejects.toMatchObject({ code: "already applied" });
  });

  it("withdrawApplication chama withdraw_application", async () => {
    rpcMock.mockResolvedValue({
      data: { id: "a1", job_id: "job-1", candidate_id: "u1", status: "withdrawn" },
      error: null,
    });
    const row = await withdrawApplication("job-1");
    expect(rpcMock).toHaveBeenCalledWith("withdraw_application", { p_job_id: "job-1" });
    expect(row.status).toBe("withdrawn");
  });

  it("loadMyApplication filtra job_id e candidate_id da sessão", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "a1", job_id: "job-1", candidate_id: "u1", status: "reviewing" },
      error: null,
    });
    const eqCandidate = vi.fn().mockReturnValue({ maybeSingle });
    const eqJob = vi.fn().mockReturnValue({ eq: eqCandidate });
    const select = vi.fn().mockReturnValue({ eq: eqJob });
    fromMock.mockReturnValue({ select });

    const row = await loadMyApplication("job-1");
    expect(fromMock).toHaveBeenCalledWith("applications");
    expect(eqJob).toHaveBeenCalledWith("job_id", "job-1");
    expect(eqCandidate).toHaveBeenCalledWith("candidate_id", "u1");
    expect(row.status).toBe("reviewing");
  });

  it("loadMyApplications filtra o candidato e ordena por updated_at", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: "a1",
          job_id: "job-1",
          candidate_id: "u1",
          status: "submitted",
          jobs: { title: "Pessoa Dev", companies: { name: "Nuvem Lauro Demo" } },
        },
      ],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select });

    const rows = await loadMyApplications();
    expect(fromMock).toHaveBeenCalledWith("applications");
    expect(eq).toHaveBeenCalledWith("candidate_id", "u1");
    expect(order).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(rows).toHaveLength(1);
    expect(rows[0].jobTitle).toBe("Pessoa Dev");
  });
});
