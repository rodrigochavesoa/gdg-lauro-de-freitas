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
  avatarStoragePath,
  displayNameFromUser,
  emptyAuthSnapshot,
  ensureProfileRow,
  invalidateAvatarSignedUrl,
  isAvatarUploadEnabled,
  isOwnAvatarStoragePath,
  mergeAuthSnapshot,
  nextAvatarVersion,
  peekAvatarSignedUrl,
  resolveHeaderIdentity,
  saveOnboardingProfile,
  saveProfileAvatar,
  subscribeAuth,
  AVATAR_CACHE_CONTROL,
  AVATAR_SIGNED_CACHE_TTL_MS,
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
    upsert: vi.fn(),
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

describe("resolveHeaderIdentity", () => {
  const session = { user: { id: "u1", user_metadata: { full_name: "Rodrigo Chaves" } } };

  it("anônimo não mostra nome nem foto", () => {
    expect(resolveHeaderIdentity({ session: null, profile: null, avatarUrl: null, avatarPath: null, avatarStatus: "idle" })).toEqual({
      pending: false,
      displayName: "",
      avatarUrl: null,
    });
  });

  it("sessão sem perfil fica pending — sem iniciais do Google", () => {
    expect(resolveHeaderIdentity({
      session,
      profile: null,
      avatarUrl: null,
      avatarPath: null,
      avatarStatus: "loading",
    })).toEqual({ pending: true, displayName: "", avatarUrl: null });
  });

  it("perfil confirmado sem avatar usa full_name, não metadata", () => {
    expect(resolveHeaderIdentity({
      session,
      profile: { full_name: "Vinicius Costa" },
      avatarUrl: "https://lh3.googleusercontent.com/old",
      avatarPath: "other/avatar.jpg",
      avatarStatus: "ready",
    })).toEqual({ pending: false, displayName: "Vinicius Costa", avatarUrl: null });
  });

  it("perfil com path espera signed URL bound ao mesmo path", () => {
    const profile = { full_name: "Vinicius Costa", avatar_path: "u1/avatar.jpg" };
    expect(resolveHeaderIdentity({
      session,
      profile,
      avatarUrl: "https://signed.example/old",
      avatarPath: "u0/avatar.jpg",
      avatarStatus: "ready",
    })).toEqual({ pending: true, displayName: "", avatarUrl: null });
    expect(resolveHeaderIdentity({
      session,
      profile,
      avatarUrl: "https://signed.example/u1",
      avatarPath: "u1/avatar.jpg",
      avatarStatus: "ready",
    })).toEqual({ pending: false, displayName: "Vinicius Costa", avatarUrl: "https://signed.example/u1" });
  });

  it("erro de signed URL cai nas iniciais do perfil confirmado", () => {
    expect(resolveHeaderIdentity({
      session,
      profile: { full_name: "Vinicius Costa", avatar_path: "u1/avatar.jpg" },
      avatarUrl: null,
      avatarPath: "u1/avatar.jpg",
      avatarStatus: "ready",
    })).toEqual({ pending: false, displayName: "Vinicius Costa", avatarUrl: null });
  });

  it("full_name vazio no perfil confirmado usa Candidato, não Google", () => {
    expect(resolveHeaderIdentity({
      session,
      profile: { full_name: "  " },
      avatarUrl: null,
      avatarPath: null,
      avatarStatus: "ready",
    }).displayName).toBe("Candidato");
  });
});

describe("ensureProfileRow", () => {
  beforeEach(() => {
    supabaseState.enabled = true;
    supabaseState.from.mockReset();
  });

  it("reusa perfil já existente sem upsert", async () => {
    const upsert = vi.fn();
    const maybeSingle = vi.fn(async () => ({ data: profile, error: null }));
    supabaseState.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle })),
      })),
      upsert,
      insert: vi.fn(),
    });

    await expect(ensureProfileRow(user)).resolves.toEqual(profile);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("deduplica duas inicializações simultâneas e não envia role nem e-mail", async () => {
    const firstSelect = deferred();
    let selectCalls = 0;
    const maybeSingle = vi.fn(() => {
      selectCalls += 1;
      if (selectCalls === 1) {
        return firstSelect.promise.then(() => ({ data: null, error: null }));
      }
      return Promise.resolve({ data: profile, error: null });
    });
    const upsert = vi.fn(async () => ({ data: null, error: null }));
    const insert = vi.fn();
    supabaseState.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle })),
      })),
      upsert,
      insert,
    });

    const first = ensureProfileRow(user);
    const second = ensureProfileRow(user);
    firstSelect.resolve();
    const [a, b] = await Promise.all([first, second]);

    expect(a).toEqual(profile);
    expect(b).toEqual(profile);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(insert).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(
      { id: "u1", full_name: "Ana Demo" },
      { onConflict: "id", ignoreDuplicates: true },
    );
    expect(upsert.mock.calls[0][0]).not.toHaveProperty("role");
    expect(upsert.mock.calls[0][0]).not.toHaveProperty("email");
  });

  it("trata conflito 23505 em profiles_pkey como sucesso e relê o perfil", async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: profile, error: null });
    const upsert = vi.fn(async () => ({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "profiles_pkey"',
      },
    }));
    supabaseState.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle })),
      })),
      upsert,
      insert: vi.fn(),
    });

    await expect(ensureProfileRow(user)).resolves.toEqual(profile);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("não ignora 23505 de outra constraint única", async () => {
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const upsert = vi.fn(async () => ({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "applications_job_id_candidate_id_key"',
      },
    }));
    supabaseState.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle })),
      })),
      upsert,
      insert: vi.fn(),
    });

    await expect(ensureProfileRow(user)).rejects.toThrow(/duplicate key/);
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
    expect(onChange).toHaveBeenCalledWith(emptyAuthSnapshot(), { hydrated: true });
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
    expect(onChange).toHaveBeenLastCalledWith(
      {
        session,
        profile: null,
        needsOnboarding: false,
      },
      { hydrated: false },
    );

    pending.resolve(profile);
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        {
          session,
          profile,
          needsOnboarding: false,
        },
        { hydrated: true },
      );
    });
    expect(supabaseState.getSession).not.toHaveBeenCalled();
  });

  it("falha de hidratação não marca a sessão como pronta", async () => {
    supabaseState.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn(async () => ({ data: null, error: { message: "timeout" } })),
        }),
      }),
    });
    const onChange = vi.fn();
    subscribeAuth(onChange);
    emitAuth("SIGNED_IN", session);

    await vi.waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        {
          session,
          profile: null,
          needsOnboarding: false,
        },
        { hydrated: false, failed: true },
      );
    });
    expect(onChange.mock.calls.some((call) => call[1]?.hydrated === true)).toBe(false);
    expect(supabaseState.getSession).not.toHaveBeenCalled();
  });

  it("SIGNED_OUT esvazia na hora e ignora hidratação atrasada", async () => {
    const pending = deferred();
    mockProfileFetch(profile, pending.promise);
    const onChange = vi.fn();
    subscribeAuth(onChange);

    supabaseState.session = session;
    emitAuth("SIGNED_IN", session);
    emitAuth("SIGNED_OUT", null);

    expect(onChange).toHaveBeenLastCalledWith(emptyAuthSnapshot(), { hydrated: true });
    const callsAfterSignOut = onChange.mock.calls.length;

    pending.resolve(profile);
    await Promise.resolve();
    await Promise.resolve();
    expect(onChange.mock.calls.length).toBe(callsAfterSignOut);
    expect(onChange).toHaveBeenLastCalledWith(emptyAuthSnapshot(), { hydrated: true });
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

describe("saveOnboardingProfile", () => {
  beforeEach(() => {
    supabaseState.enabled = true;
    supabaseState.from.mockReset();
    supabaseState.getUser.mockReset();
  });

  it("atualiza só campos do onboarding, sem role nem e-mail", async () => {
    supabaseState.getUser.mockResolvedValue({ data: { user }, error: null });
    const maybeSingle = vi.fn(async () => ({
      data: { ...profile, preferences: { ...profile.preferences, extra: "keep" } },
      error: null,
    }));
    const single = vi.fn(async () => ({ data: { ...profile, full_name: "Ana Atualizada" }, error: null }));
    const eqUpdate = vi.fn(() => ({
      select: vi.fn(() => ({ single })),
    }));
    const update = vi.fn(() => ({ eq: eqUpdate }));
    supabaseState.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle })),
      })),
      update,
    });

    const saved = await saveOnboardingProfile({
      fullName: "Ana Atualizada",
      experienceLevel: "senior",
      skillsText: "React, Go",
      location: "Salvador",
      workModel: "hybrid",
      bio: "Bio",
      linkedin: "https://linkedin.com/in/ana",
      github: "",
      cvUrl: "https://cv.example/ana.pdf",
    });

    expect(saved.full_name).toBe("Ana Atualizada");
    expect(update).toHaveBeenCalledTimes(1);
    const payload = update.mock.calls[0][0];
    expect(payload).toEqual(expect.objectContaining({
      full_name: "Ana Atualizada",
      bio: "Bio",
      skills: ["React", "Go"],
    }));
    expect(payload).not.toHaveProperty("role");
    expect(payload).not.toHaveProperty("email");
    expect(payload.preferences).toEqual(expect.objectContaining({
      extra: "keep",
      experience_level: "senior",
      work_model: "hybrid",
      location: "Salvador",
      linkedin: "https://linkedin.com/in/ana",
      github: null,
      cv_url: "https://cv.example/ana.pdf",
    }));
    expect(eqUpdate).toHaveBeenCalledWith("id", "u1");
  });
});

const AVATAR_VERSION = "11111111-1111-4111-8111-111111111111";
const NEW_AVATAR_PATH = `u1/${AVATAR_VERSION}.jpg`;
const OLD_AVATAR_PATH = "u1/avatar.jpg";

function mockAvatarSave({ previousPath = OLD_AVATAR_PATH, persist, upload, remove } = {}) {
  const maybeSingle = vi.fn(async () => ({
    data: { ...profile, avatar_path: previousPath },
    error: null,
  }));
  const single =
    persist ??
    vi.fn(async () => ({ data: { ...profile, avatar_path: NEW_AVATAR_PATH }, error: null }));
  supabaseState.from.mockReturnValue({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({ single })),
      })),
    })),
  });
  const uploadFn = upload ?? vi.fn(async () => ({ error: null }));
  const removeFn = remove ?? vi.fn(async () => ({ error: null }));
  supabaseState.storageFrom.mockReturnValue({
    upload: uploadFn,
    remove: removeFn,
    createSignedUrl: vi.fn(async () => ({
      data: { signedUrl: "https://signed.example/u1" },
      error: null,
    })),
  });
  return { upload: uploadFn, remove: removeFn, single, maybeSingle };
}

describe("avatarPublicUrl e saveProfileAvatar", () => {
  let randomUUIDSpy;

  beforeEach(() => {
    supabaseState.enabled = true;
    supabaseState.from.mockReset();
    supabaseState.storageFrom.mockReset();
    supabaseState.getUser.mockReset();
    invalidateAvatarSignedUrl();
    randomUUIDSpy = vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(AVATAR_VERSION);
  });

  afterEach(() => {
    randomUUIDSpy?.mockRestore();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    invalidateAvatarSignedUrl();
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

  it("reusa signed URL em memória e deduplica promises concorrentes", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: "https://signed.example/u1" }, error: null }));
    supabaseState.storageFrom.mockReturnValue({ createSignedUrl });
    const first = avatarPublicUrl("u1/avatar.jpg", { userId: "u1" });
    const second = avatarPublicUrl("u1/avatar.jpg", { userId: "u1" });
    expect(await first).toBe("https://signed.example/u1");
    expect(await second).toBe("https://signed.example/u1");
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
    expect(await avatarPublicUrl("u1/avatar.jpg", { userId: "u1" })).toBe("https://signed.example/u1");
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
    expect(peekAvatarSignedUrl("u1", "u1/avatar.jpg")).toBe("https://signed.example/u1");
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it("avatarPublicUrl não reutiliza signed URL após expirar o cache de 55 min (relógio controlado)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-18T00:00:00.000Z"));
    let call = 0;
    const createSignedUrl = vi.fn(async () => ({
      data: { signedUrl: `https://signed.example/u1?v=${++call}` },
      error: null,
    }));
    supabaseState.storageFrom.mockReturnValue({ createSignedUrl });
    expect(await avatarPublicUrl("u1/avatar.jpg", { userId: "u1" })).toBe("https://signed.example/u1?v=1");
    expect(await avatarPublicUrl("u1/avatar.jpg", { userId: "u1" })).toBe("https://signed.example/u1?v=1");
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date("2026-09-18T00:00:00.000Z").getTime() + AVATAR_SIGNED_CACHE_TTL_MS + 1);
    expect(peekAvatarSignedUrl("u1", "u1/avatar.jpg")).toBeNull();
    expect(await avatarPublicUrl("u1/avatar.jpg", { userId: "u1" })).toBe("https://signed.example/u1?v=2");
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("expira o cache antes do TTL da signed URL e invalida só a própria chave", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-18T00:00:00.000Z"));
    const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: "https://signed.example/u1" }, error: null }));
    supabaseState.storageFrom.mockReturnValue({ createSignedUrl });
    await avatarPublicUrl("u1/avatar.jpg", { userId: "u1" });
    await avatarPublicUrl("u2/avatar.jpg", { userId: "u2" });
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
    invalidateAvatarSignedUrl("u1", "u1/avatar.jpg");
    expect(peekAvatarSignedUrl("u1", "u1/avatar.jpg")).toBeNull();
    expect(peekAvatarSignedUrl("u2", "u2/avatar.jpg")).toBe("https://signed.example/u1");
    await avatarPublicUrl("u1/avatar.jpg", { userId: "u1" });
    expect(createSignedUrl).toHaveBeenCalledTimes(3);
    vi.setSystemTime(new Date("2026-09-18T00:00:00.000Z").getTime() + AVATAR_SIGNED_CACHE_TTL_MS + 1);
    expect(peekAvatarSignedUrl("u2", "u2/avatar.jpg")).toBeNull();
    await avatarPublicUrl("u2/avatar.jpg", { userId: "u2" });
    expect(createSignedUrl).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });

  it("saveProfileAvatar invalida a signed URL do path antigo e do novo", async () => {
    vi.stubEnv("VITE_AVATAR_UPLOAD_ENABLED", "true");
    supabaseState.getUser.mockResolvedValue({ data: { user }, error: null });
    const { upload } = mockAvatarSave();
    await avatarPublicUrl(OLD_AVATAR_PATH, { userId: "u1" });
    expect(peekAvatarSignedUrl("u1", OLD_AVATAR_PATH)).toBe("https://signed.example/u1");
    await saveProfileAvatar(new Blob(["x"], { type: "image/jpeg" }));
    expect(upload).toHaveBeenCalled();
    expect(peekAvatarSignedUrl("u1", OLD_AVATAR_PATH)).toBeNull();
    expect(peekAvatarSignedUrl("u1", NEW_AVATAR_PATH)).toBeNull();
  });

  it("faz upload em {userId}/{version}.jpg, cache 3600 e persiste avatar_path", async () => {
    vi.stubEnv("VITE_AVATAR_UPLOAD_ENABLED", "true");
    supabaseState.getUser.mockResolvedValue({ data: { user }, error: null });
    const { upload, remove } = mockAvatarSave();
    const blob = new Blob(["x"], { type: "image/jpeg" });
    const saved = await saveProfileAvatar(blob);
    expect(upload).toHaveBeenCalledWith(
      NEW_AVATAR_PATH,
      blob,
      expect.objectContaining({
        upsert: false,
        contentType: "image/jpeg",
        cacheControl: AVATAR_CACHE_CONTROL,
      }),
    );
    expect(AVATAR_CACHE_CONTROL).toBe("3600");
    expect(saved.avatar_path).toBe(NEW_AVATAR_PATH);
    expect(remove).toHaveBeenCalledWith([OLD_AVATAR_PATH]);
  });

  it("repete o UPDATE se o perfil falhar depois do upload e só então remove o objeto antigo", async () => {
    vi.stubEnv("VITE_AVATAR_UPLOAD_ENABLED", "true");
    supabaseState.getUser.mockResolvedValue({ data: { user }, error: null });
    const persist = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "timeout" } })
      .mockResolvedValueOnce({ data: { ...profile, avatar_path: NEW_AVATAR_PATH }, error: null });
    const { remove, single } = mockAvatarSave({ persist });
    const saved = await saveProfileAvatar(new Blob(["x"], { type: "image/jpeg" }));
    expect(single).toHaveBeenCalledTimes(2);
    expect(saved.avatar_path).toBe(NEW_AVATAR_PATH);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("não apaga o objeto anterior se o path não for da pasta do usuário", async () => {
    vi.stubEnv("VITE_AVATAR_UPLOAD_ENABLED", "true");
    supabaseState.getUser.mockResolvedValue({ data: { user }, error: null });
    const { remove } = mockAvatarSave({ previousPath: "u2/avatar.jpg" });
    await saveProfileAvatar(new Blob(["x"], { type: "image/jpeg" }));
    expect(remove).not.toHaveBeenCalled();
  });

  it("conclui o save se a limpeza do objeto antigo falhar", async () => {
    vi.stubEnv("VITE_AVATAR_UPLOAD_ENABLED", "true");
    supabaseState.getUser.mockResolvedValue({ data: { user }, error: null });
    const remove = vi.fn(async () => ({ error: { message: "storage timeout" } }));
    const { upload } = mockAvatarSave({ remove });
    const saved = await saveProfileAvatar(new Blob(["x"], { type: "image/jpeg" }));
    expect(upload).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith([OLD_AVATAR_PATH]);
    expect(saved.avatar_path).toBe(NEW_AVATAR_PATH);
  });

  it("não chama remove quando não havia avatar_path anterior", async () => {
    vi.stubEnv("VITE_AVATAR_UPLOAD_ENABLED", "true");
    supabaseState.getUser.mockResolvedValue({ data: { user }, error: null });
    const { remove } = mockAvatarSave({ previousPath: null });
    await saveProfileAvatar(new Blob(["x"], { type: "image/jpeg" }));
    expect(remove).not.toHaveBeenCalled();
  });

  it("fail-closed por default e só liga com true", () => {
    import.meta.env.VITE_AVATAR_UPLOAD_ENABLED = undefined;
    expect(isAvatarUploadEnabled()).toBe(false);
    for (const value of ["", "0", "1", "false", "yes"]) {
      vi.stubEnv("VITE_AVATAR_UPLOAD_ENABLED", value);
      expect(isAvatarUploadEnabled()).toBe(false);
    }
    vi.stubEnv("VITE_AVATAR_UPLOAD_ENABLED", "true");
    expect(isAvatarUploadEnabled()).toBe(true);
    expect(avatarStoragePath("u1", AVATAR_VERSION)).toBe(NEW_AVATAR_PATH);
    expect(avatarStoragePath("u1", "avatar")).toBe("u1/avatar.jpg");
    expect(() => avatarStoragePath("u1", "../x")).toThrow(/inválida/);
    expect(() => avatarStoragePath("u1", "a/b")).toThrow(/inválida/);
    expect(isOwnAvatarStoragePath("u1", "u1/avatar.jpg")).toBe(true);
    expect(isOwnAvatarStoragePath("u1", "u1/nested/x.jpg")).toBe(false);
    expect(isOwnAvatarStoragePath("u1", "u2/avatar.jpg")).toBe(false);
    expect(nextAvatarVersion()).toBe(AVATAR_VERSION);
  });

  it("bloqueia saveProfileAvatar quando a flag está off", async () => {
    vi.stubEnv("VITE_AVATAR_UPLOAD_ENABLED", "");
    await expect(saveProfileAvatar(new Blob(["x"], { type: "image/jpeg" }))).rejects.toThrow(/indisponível/);
  });
});
