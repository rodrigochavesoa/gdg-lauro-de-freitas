import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supabaseState = vi.hoisted(() => ({
  enabled: true,
  session: null,
  listeners: [],
  getSession: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  storageFrom: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("../../lib/supabase-client.js", () => ({
  getSupabaseBrowserClient: () =>
    supabaseState.enabled
      ? {
          from: supabaseState.from,
          storage: { from: supabaseState.storageFrom },
          auth: {
            getSession: supabaseState.getSession,
            getUser: supabaseState.getUser,
            onAuthStateChange: (cb) => {
              supabaseState.listeners.push(cb);
              return { data: { subscription: { unsubscribe: supabaseState.unsubscribe } } };
            },
          },
        }
      : null,
}));

import {
  avatarPublicUrl,
  displayNameFromUser,
  emptyAuthSnapshot,
  mergeAuthSnapshot,
  saveProfileAvatar,
  subscribeAuth,
} from "./auth-api.js";

const user = {
  id: "u1",
  email: "ana@example.invalid",
  user_metadata: { full_name: "Ana Demo" },
};
const session = { user, access_token: "t1" };
const profile = {
  id: "u1",
  full_name: "Ana Demo",
  role: "candidate",
  skills: ["React"],
  preferences: { experience_level: "mid", work_model: "remote", location: "Brasil" },
};

function mockProfileFetch(row, pendingPromise) {
  const maybeSingle = vi.fn(() => {
    if (pendingPromise) {
      return pendingPromise.then((data) => ({ data, error: null }));
    }
    return Promise.resolve({ data: row, error: null });
  });
  supabaseState.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ maybeSingle }),
    }),
    insert: vi.fn(),
  });
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function emitAuth(event, nextSession) {
  for (const listener of supabaseState.listeners) {
    listener(event, nextSession);
  }
}

describe("displayNameFromUser e mergeAuthSnapshot", () => {
  it("prioriza metadata e cai no local-part do e-mail", () => {
    expect(displayNameFromUser({ user_metadata: { full_name: "Ana Demo" } })).toBe("Ana Demo");
    expect(displayNameFromUser({ email: "ana@example.invalid", user_metadata: {} })).toBe("ana");
    expect(displayNameFromUser(null)).toBe("Candidato");
  });

  it("snapshot sem sessão esvazia o estado", () => {
    expect(mergeAuthSnapshot({ session, profile, needsOnboarding: false }, emptyAuthSnapshot())).toEqual(
      emptyAuthSnapshot(),
    );
  });

  it("snapshot só-sessão do mesmo userId mantém o perfil", () => {
    const current = { session, profile, needsOnboarding: false };
    const incoming = { session: { ...session, access_token: "t2" }, profile: null, needsOnboarding: false };
    expect(mergeAuthSnapshot(current, incoming)).toEqual({
      session: incoming.session,
      profile,
      needsOnboarding: false,
    });
  });

  it("troca de userId descarta o perfil anterior", () => {
    const incoming = {
      session: { user: { id: "u2", email: "ada@example.invalid" } },
      profile: null,
      needsOnboarding: false,
    };
    expect(mergeAuthSnapshot({ session, profile, needsOnboarding: false }, incoming)).toEqual(incoming);
  });

  it("perfil incoming substitui o cache", () => {
    const nextProfile = { ...profile, full_name: "Ana Atualizada" };
    const incoming = { session, profile: nextProfile, needsOnboarding: false };
    expect(mergeAuthSnapshot({ session, profile, needsOnboarding: true }, incoming)).toEqual(incoming);
  });
});

describe("subscribeAuth", () => {
  beforeEach(() => {
    supabaseState.enabled = true;
    supabaseState.session = null;
    supabaseState.listeners = [];
    supabaseState.getSession.mockReset();
    supabaseState.getUser.mockReset();
    supabaseState.from.mockReset();
    supabaseState.storageFrom.mockReset();
    supabaseState.unsubscribe.mockReset();
    supabaseState.getSession.mockImplementation(async () => ({
      data: { session: supabaseState.session },
      error: null,
    }));
  });

  afterEach(() => {
    supabaseState.enabled = true;
  });

  it("sem cliente aplica snapshot vazio na hora", () => {
    supabaseState.enabled = false;
    const onChange = vi.fn();
    const unsubscribe = subscribeAuth(onChange);
    expect(onChange).toHaveBeenCalledWith(emptyAuthSnapshot());
    unsubscribe();
  });

  it("SIGNED_IN aplica a sessão na hora e hidrata o perfil depois", async () => {
    const pending = deferred();
    mockProfileFetch(profile, pending.promise);
    const onChange = vi.fn();
    subscribeAuth(onChange);

    supabaseState.session = session;
    emitAuth("SIGNED_IN", session);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({
      session,
      profile: null,
      needsOnboarding: false,
    });

    pending.resolve(profile);
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith({
        session,
        profile,
        needsOnboarding: false,
      });
    });
  });

  it("SIGNED_OUT esvazia na hora e ignora hidratação atrasada", async () => {
    const pending = deferred();
    mockProfileFetch(profile, pending.promise);
    const onChange = vi.fn();
    subscribeAuth(onChange);

    supabaseState.session = session;
    emitAuth("SIGNED_IN", session);
    emitAuth("SIGNED_OUT", null);

    expect(onChange).toHaveBeenLastCalledWith(emptyAuthSnapshot());
    const callsAfterSignOut = onChange.mock.calls.length;

    pending.resolve(profile);
    await Promise.resolve();
    await Promise.resolve();
    expect(onChange.mock.calls.length).toBe(callsAfterSignOut);
    expect(onChange).toHaveBeenLastCalledWith(emptyAuthSnapshot());
  });

  it("TOKEN_REFRESHED do mesmo userId não derruba o perfil", async () => {
    mockProfileFetch(profile);
    const onChange = vi.fn();
    subscribeAuth(onChange);

    supabaseState.session = session;
    emitAuth("SIGNED_IN", session);
    await vi.waitFor(() => {
      expect(onChange.mock.calls.at(-1)[0].profile).toEqual(profile);
    });

    const refreshed = { ...session, access_token: "t2" };
    supabaseState.session = refreshed;
    emitAuth("TOKEN_REFRESHED", refreshed);

    const syncCall = onChange.mock.calls.findLast((call) => call[0].session?.access_token === "t2");
    expect(syncCall[0].profile).toEqual(profile);
    expect(syncCall[0].needsOnboarding).toBe(false);
  });
});

describe("avatarPublicUrl e saveProfileAvatar", () => {
  beforeEach(() => {
    supabaseState.enabled = true;
    supabaseState.from.mockReset();
    supabaseState.storageFrom.mockReset();
    supabaseState.getUser.mockReset();
  });

  it("sem path ou sem cliente não monta URL", async () => {
    expect(await avatarPublicUrl("")).toBeNull();
    supabaseState.enabled = false;
    expect(await avatarPublicUrl("u1/avatar.jpg")).toBeNull();
  });

  it("devolve signed URL centralizada", async () => {
    const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: "https://signed.example/u1" }, error: null }));
    supabaseState.storageFrom.mockReturnValue({ createSignedUrl });
    expect(await avatarPublicUrl("u1/avatar.jpg")).toBe("https://signed.example/u1");
    expect(supabaseState.storageFrom).toHaveBeenCalledWith("avatars");
    expect(createSignedUrl).toHaveBeenCalledWith("u1/avatar.jpg", 3600);
  });

  it("faz upload em {userId}/* e persiste avatar_path", async () => {
    supabaseState.getUser.mockResolvedValue({ data: { user }, error: null });
    const upload = vi.fn(async () => ({ error: null }));
    supabaseState.storageFrom.mockReturnValue({ upload });
    const single = vi.fn(async () => ({ data: { ...profile, avatar_path: "u1/avatar.jpg" }, error: null }));
    supabaseState.from.mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({ single })),
        })),
      })),
    });
    const blob = new Blob(["x"], { type: "image/jpeg" });
    const saved = await saveProfileAvatar(blob);
    expect(upload).toHaveBeenCalledWith(
      "u1/avatar.jpg",
      blob,
      expect.objectContaining({ upsert: true, contentType: "image/jpeg" }),
    );
    expect(saved.avatar_path).toBe("u1/avatar.jpg");
  });
});
