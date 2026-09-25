import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  APPLICATION_LIST_LIMIT,
  applyToJob,
  canWithdrawStatus,
  createApplyError,
  getApplyErrorCode,
  invalidateMyApplicationsCache,
  loadMyApplication,
  loadMyApplications,
  MY_APPLICATIONS_CACHE_TTL_MS,
  parseApplication,
  peekMyApplicationsCache,
  withdrawApplication,
} from "./apply-api.js";

function mockApplicationsList(data, pending) {
  const range = vi.fn(() => {
    if (pending) {
      return new Promise((resolve) => {
        pending.resolveLimit = () => resolve({ data, error: null });
      });
    }
    return Promise.resolve({ data, error: null });
  });
  const order = vi.fn();
  const chain = { order, range };
  order.mockReturnValue(chain);
  const eq = vi.fn().mockReturnValue(chain);
  const select = vi.fn().mockReturnValue({ eq });
  fromMock.mockReturnValue({ select });
  return { range, order, eq, select };
}

function applicationRow(id, jobId = `job-${id}`) {
  return {
    id,
    job_id: jobId,
    candidate_id: "u1",
    status: "submitted",
    jobs: { title: "Pessoa Dev", companies: { name: "Nuvem Lauro Demo" } },
  };
}

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
    expect(createApplyError({ message: "rate limit exceeded" }).code).toBe("rate limit exceeded");
    expect(createApplyError({ message: "rate limit exceeded" }).status).toBe(429);
    expect(createApplyError({ message: "job is not approved" }).message).toMatch(/não está disponível/);
    expect(createApplyError({ message: "staff cannot apply" }).code).toBe("staff cannot apply");
    expect(createApplyError({ message: "staff cannot apply" }).message).toMatch(/staff não se candidatam/);
    expect(createApplyError({ message: "staff cannot withdraw" }).code).toBe("staff cannot withdraw");
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
    invalidateMyApplicationsCache();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("applyToJob mapeia already applied no payload JSON (log persistido)", async () => {
    rpcMock.mockResolvedValue({ data: { error: "already applied" }, error: null });
    await expect(applyToJob("job-1")).rejects.toMatchObject({ code: "already applied" });
  });

  it("applyToJob mapeia rate limit exceeded para status 429", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "rate limit exceeded" } });
    await expect(applyToJob("job-1")).rejects.toMatchObject({ code: "rate limit exceeded", status: 429 });
  });

  it("rate limit da candidatura não escreve e-mail, JWT nem senha no console", async () => {
    vi.stubEnv("VITE_OPS_EMIT", "true");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      rpcMock.mockResolvedValue({
        data: null,
        error: {
          message: "rate limit exceeded pessoa@example.com password=hunter2 token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig",
        },
      });
      await expect(applyToJob("job-1")).rejects.toMatchObject({ code: "rate limit exceeded", status: 429 });
      const events = info.mock.calls.map((call) => call[0]).filter((entry) => entry?.event_name === "ops.application");
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        outcome: "rate_limited",
        error_class: "rate_limited",
        action: "apply_to_job",
        route: "/jobs/:id",
      });
      expect(JSON.stringify(info.mock.calls)).not.toMatch(/pessoa@example.com|hunter2|eyJ/);
    } finally {
      info.mockRestore();
      vi.unstubAllEnvs();
    }
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
    expect(getUserMock).toHaveBeenCalled();
    expect(fromMock).toHaveBeenCalledWith("applications");
    expect(eqJob).toHaveBeenCalledWith("job_id", "job-1");
    expect(eqCandidate).toHaveBeenCalledWith("candidate_id", "u1");
    expect(row.status).toBe("reviewing");
  });

  it("loadMyApplication com userId não chama getUser", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "a1", job_id: "job-1", candidate_id: "u1", status: "submitted" },
      error: null,
    });
    const eqCandidate = vi.fn().mockReturnValue({ maybeSingle });
    const eqJob = vi.fn().mockReturnValue({ eq: eqCandidate });
    const select = vi.fn().mockReturnValue({ eq: eqJob });
    fromMock.mockReturnValue({ select });

    const row = await loadMyApplication("job-1", "u1");
    expect(getUserMock).not.toHaveBeenCalled();
    expect(eqCandidate).toHaveBeenCalledWith("candidate_id", "u1");
    expect(row.status).toBe("submitted");
  });

  it("loadMyApplications filtra o candidato e ordena por updated_at", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const { eq, order, range, select } = mockApplicationsList([
      {
        id: "a1",
        job_id: "job-1",
        candidate_id: "u1",
        status: "submitted",
        jobs: { title: "Pessoa Dev", companies: { name: "Nuvem Lauro Demo" } },
      },
    ]);

    const page = await loadMyApplications();
    expect(fromMock).toHaveBeenCalledWith("applications");
    expect(eq).toHaveBeenCalledWith("candidate_id", "u1");
    expect(order).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(order).toHaveBeenCalledWith("id", { ascending: false });
    expect(order.mock.calls).toEqual([
      ["updated_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(range).toHaveBeenCalledWith(0, APPLICATION_LIST_LIMIT);
    expect(select.mock.calls[0][0]).not.toMatch(/snapshot/);
    expect(page.applications).toHaveLength(1);
    expect(page.hasMore).toBe(false);
    expect(page.applications[0].jobTitle).toBe("Pessoa Dev");
  });

  it("loadMyApplications com userId não chama getUser", async () => {
    mockApplicationsList([
      {
        id: "a1",
        job_id: "job-1",
        candidate_id: "u1",
        status: "submitted",
        jobs: { title: "Pessoa Dev", companies: { name: "Nuvem Lauro Demo" } },
      },
    ]);

    const page = await loadMyApplications("u1");
    expect(getUserMock).not.toHaveBeenCalled();
    expect(page.applications).toHaveLength(1);
    expect(page.hasMore).toBe(false);
    expect(page.applications[0].jobTitle).toBe("Pessoa Dev");
  });

  it("reusa o cache na segunda chamada dentro do TTL", async () => {
    mockApplicationsList([
      {
        id: "a1",
        job_id: "job-1",
        candidate_id: "u1",
        status: "submitted",
        jobs: { title: "Pessoa Dev", companies: { name: "Nuvem Lauro Demo" } },
      },
    ]);

    const first = await loadMyApplications({ userId: "u1" });
    const second = await loadMyApplications({ userId: "u1" });
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(peekMyApplicationsCache("u1")).toBe(first);
  });

  it("ignora o cache quando forceRefresh é true", async () => {
    mockApplicationsList([{ id: "a1", job_id: "job-1", candidate_id: "u1", status: "submitted" }]);
    await loadMyApplications({ userId: "u1" });
    mockApplicationsList([{ id: "a1", job_id: "job-1", candidate_id: "u1", status: "submitted" }]);
    await loadMyApplications({ userId: "u1", forceRefresh: true });
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it("expira o peek depois do TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T00:00:00.000Z"));
    mockApplicationsList([{ id: "a1", job_id: "job-1", candidate_id: "u1", status: "submitted" }]);
    await loadMyApplications({ userId: "u1" });
    expect(peekMyApplicationsCache("u1")).not.toBeNull();
    vi.setSystemTime(new Date("2026-09-09T00:00:00.000Z").getTime() + MY_APPLICATIONS_CACHE_TTL_MS + 1);
    expect(peekMyApplicationsCache("u1")).toBeNull();
    vi.useRealTimers();
  });

  it("deduplica fetches concorrentes enquanto o primeiro está em voo", async () => {
    const pending = {};
    mockApplicationsList([{ id: "a1", job_id: "job-1", candidate_id: "u1", status: "submitted" }], pending);

    const first = loadMyApplications({ userId: "u1" });
    const second = loadMyApplications({ userId: "u1" });
    expect(fromMock).toHaveBeenCalledTimes(1);
    pending.resolveLimit();
    expect((await first).applications).toHaveLength(1);
    expect((await second).applications).toHaveLength(1);
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it("applyToJob invalida o cache da lista", async () => {
    mockApplicationsList([{ id: "a1", job_id: "job-1", candidate_id: "u1", status: "submitted" }]);
    await loadMyApplications({ userId: "u1" });
    expect(peekMyApplicationsCache("u1")).not.toBeNull();

    rpcMock.mockResolvedValue({
      data: { id: "a2", job_id: "job-2", candidate_id: "u1", status: "submitted" },
      error: null,
    });
    await applyToJob("job-2");
    expect(peekMyApplicationsCache("u1")).toBeNull();
  });

  it("withdrawApplication invalida o cache da lista", async () => {
    mockApplicationsList([{ id: "a1", job_id: "job-1", candidate_id: "u1", status: "submitted" }]);
    await loadMyApplications({ userId: "u1" });
    expect(peekMyApplicationsCache("u1")).not.toBeNull();

    rpcMock.mockResolvedValue({
      data: { id: "a1", job_id: "job-1", candidate_id: "u1", status: "withdrawn" },
      error: null,
    });
    await withdrawApplication("job-1");
    expect(peekMyApplicationsCache("u1")).toBeNull();
  });

  it("marca hasMore quando a página volta uma linha além do limite", async () => {
    const rows = Array.from({ length: APPLICATION_LIST_LIMIT + 1 }, (_, index) =>
      applicationRow(`a${index}`),
    );
    mockApplicationsList(rows);
    const page = await loadMyApplications({ userId: "u1" });
    expect(page.applications).toHaveLength(APPLICATION_LIST_LIMIT);
    expect(page.hasMore).toBe(true);
    expect(page.applications.at(-1).id).toBe(`a${APPLICATION_LIST_LIMIT - 1}`);
  });

  it("página 2 usa range 100–200 e não substitui o cache da primeira página", async () => {
    mockApplicationsList([applicationRow("a1")]);
    const first = await loadMyApplications({ userId: "u1" });
    const { range } = mockApplicationsList([applicationRow("a101", "job-101")]);
    const second = await loadMyApplications({ userId: "u1", page: 2 });
    expect(range).toHaveBeenCalledWith(APPLICATION_LIST_LIMIT, APPLICATION_LIST_LIMIT * 2);
    expect(second.applications).toHaveLength(1);
    expect(second.applications[0].id).toBe("a101");
    expect(peekMyApplicationsCache("u1")).toBe(first);
  });

  it("desempata páginas com o mesmo updated_at por id", async () => {
    const sameTime = "2026-09-07T00:00:00.000Z";
    const { order } = mockApplicationsList([
      { ...applicationRow("a2"), updated_at: sameTime },
      { ...applicationRow("a1"), updated_at: sameTime },
    ]);
    await loadMyApplications({ userId: "u1" });
    expect(order.mock.calls).toEqual([
      ["updated_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
  });
});
