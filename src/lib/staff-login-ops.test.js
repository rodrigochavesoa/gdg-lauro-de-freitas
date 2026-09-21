import { beforeEach, describe, expect, it, vi } from "vitest";

const { client } = vi.hoisted(() => ({
  client: {
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock("./supabase-client.js", () => ({
  getSupabaseBrowserClient: () => client,
}));

import { signInAdmin } from "./admin-api.js";
import { resubmitJobForCuration, setJobCurationPriority, signInCuration, submitCurationReview } from "../features/curation/curation-api.js";

const STAFF_EMAIL = "pessoa@example.com";
const STAFF_PASSWORD = "hunter2-senha";

function mockProfile(result) {
  client.from.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve(result),
      }),
    }),
  });
}

function mockSignedInUser() {
  client.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  client.auth.signOut.mockResolvedValue({ error: null });
  client.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-1", email: STAFF_EMAIL } },
    error: null,
  });
}

async function captureOps(run) {
  vi.stubEnv("VITE_OPS_EMIT", "true");
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  let thrown = null;
  try {
    await run();
  } catch (error) {
    thrown = error;
  }
  const events = info.mock.calls.map((call) => call[0]).filter((entry) => entry?.event_name);
  info.mockRestore();
  vi.unstubAllEnvs();
  return { thrown, events };
}

describe("login staff — papel e rede", () => {
  beforeEach(() => {
    client.auth.getUser.mockReset();
    client.auth.signInWithPassword.mockReset();
    client.auth.signOut.mockReset();
    client.from.mockReset();
    client.rpc.mockReset();
  });

  it("perfil ausente na curadoria emite auth_forbidden", async () => {
    mockSignedInUser();
    mockProfile({ data: null, error: null });
    const { thrown, events } = await captureOps(() => signInCuration(STAFF_EMAIL, STAFF_PASSWORD));
    expect(thrown?.message).toMatch(/permissão de curadoria/);
    expect(client.auth.signOut).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event_name: "ops.login",
      action: "staff_password",
      outcome: "blocked",
      error_class: "auth_forbidden",
    });
    expect(JSON.stringify(events)).not.toMatch(/pessoa@example.com|hunter2/);
  });

  it("papel inválido no admin emite auth_forbidden", async () => {
    mockSignedInUser();
    mockProfile({ data: { role: "candidate" }, error: null });
    const { thrown, events } = await captureOps(() => signInAdmin(STAFF_EMAIL, STAFF_PASSWORD));
    expect(thrown?.message).toMatch(/não é administradora/);
    expect(client.auth.signOut).toHaveBeenCalledTimes(1);
    expect(events[0]).toMatchObject({
      event_name: "ops.login",
      outcome: "blocked",
      error_class: "auth_forbidden",
    });
    expect(JSON.stringify(events)).not.toMatch(/pessoa@example.com|hunter2/);
  });

  it("rede ao ler o perfil da curadoria emite auth_unavailable", async () => {
    mockSignedInUser();
    mockProfile({ data: null, error: { message: "Failed to fetch" } });
    const { thrown, events } = await captureOps(() => signInCuration(STAFF_EMAIL, STAFF_PASSWORD));
    expect(thrown?.message).toBe("Failed to fetch");
    expect(client.auth.signOut).not.toHaveBeenCalled();
    expect(events[0]).toMatchObject({
      event_name: "ops.login",
      action: "staff_password",
      outcome: "failure",
      error_class: "auth_unavailable",
    });
    expect(JSON.stringify(events)).not.toMatch(/pessoa@example.com|hunter2/);
  });

  it("API indisponível no admin emite auth_unavailable", async () => {
    client.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    client.auth.signOut.mockResolvedValue({ error: null });
    client.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Failed to fetch" },
    });
    const { thrown, events } = await captureOps(() => signInAdmin(STAFF_EMAIL, STAFF_PASSWORD));
    expect(thrown?.message).toBe("Failed to fetch");
    expect(client.auth.signOut).not.toHaveBeenCalled();
    expect(events[0]).toMatchObject({
      event_name: "ops.login",
      outcome: "failure",
      error_class: "auth_unavailable",
    });
    expect(JSON.stringify(events)).not.toMatch(/pessoa@example.com|hunter2/);
  });
});

describe("validação de curadoria dentro de ops.rpc", () => {
  beforeEach(() => {
    client.rpc.mockReset();
  });

  it("decisão inválida emite rpc_rejected sem o comentário", async () => {
    const { thrown, events } = await captureOps(() =>
      submitCurationReview({
        jobId: "job-1",
        decision: "maybe",
        rubricCode: "",
        internalComment: "pessoa@example.com comentario secreto",
      }),
    );
    expect(thrown?.message).toMatch(/aprovar ou rejeitar/);
    expect(client.rpc).not.toHaveBeenCalled();
    expect(events[0]).toMatchObject({
      event_name: "ops.rpc",
      action: "submit_curation_review",
      route: "/admin/curadoria",
      outcome: "failure",
      error_class: "rpc_rejected",
    });
    expect(JSON.stringify(events)).not.toMatch(/pessoa@example.com|comentario secreto/);
  });

  it("reenvio sem vaga emite rpc_rejected", async () => {
    const { thrown, events } = await captureOps(() => resubmitJobForCuration(""));
    expect(thrown?.message).toMatch(/não informada/);
    expect(events[0]).toMatchObject({
      event_name: "ops.rpc",
      action: "resubmit_job_for_curation",
      error_class: "rpc_rejected",
    });
  });

  it("prioridade inválida emite rpc_rejected sem o motivo", async () => {
    const { thrown, events } = await captureOps(() =>
      setJobCurationPriority("job-1", "later", "pessoa@example.com motivo secreto"),
    );
    expect(thrown?.message).toBe("Prioridade inválida.");
    expect(client.rpc).not.toHaveBeenCalled();
    expect(events[0]).toMatchObject({
      event_name: "ops.rpc",
      action: "set_job_curation_priority",
      error_class: "rpc_rejected",
    });
    expect(JSON.stringify(events)).not.toMatch(/pessoa@example.com|motivo secreto/);
  });
});
