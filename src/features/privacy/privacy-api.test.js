import { afterEach, describe, expect, it, vi } from "vitest";

const supabaseState = vi.hoisted(() => ({
  enabled: true,
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("../../lib/supabase-client.js", () => ({
  getSupabaseBrowserClient: () =>
    supabaseState.enabled
      ? { rpc: supabaseState.rpc, from: supabaseState.from }
      : null,
}));

import { PRIVACY_PURPOSES } from "./privacy-catalog.js";
import {
  invalidatePrivacyPreferencesCache,
  loadPrivacyPreferences,
  peekPrivacyPreferencesCache,
  PRIVACY_PREFERENCES_CACHE_TTL_MS,
  savePrivacyDecision,
} from "./privacy-api.js";

const samplePurpose = {
  purpose_code: "F-01",
  version: 1,
  title: "Criar e proteger sua conta",
};

function mockPrivacyFetch({ purposes = [samplePurpose], events = [], pending } = {}) {
  supabaseState.from.mockImplementation((table) => {
    if (table === "privacy_purposes") {
      const orderVersion = vi.fn(() => {
        if (pending) {
          return new Promise((resolve) => {
            pending.resolve = () => resolve({ data: purposes, error: null });
          });
        }
        return Promise.resolve({ data: purposes, error: null });
      });
      const orderCode = vi.fn(() => ({ order: orderVersion }));
      return { select: vi.fn(() => ({ order: orderCode })) };
    }
    return {
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: events, error: null })),
      })),
    };
  });
}

describe("privacy-api cache", () => {
  afterEach(() => {
    invalidatePrivacyPreferencesCache();
    supabaseState.enabled = true;
    supabaseState.from.mockReset();
    supabaseState.rpc.mockReset();
  });

  it("devolve o catálogo local quando não há cliente Supabase", async () => {
    supabaseState.enabled = false;
    const payload = await loadPrivacyPreferences({ userId: "u1" });
    expect(payload.source).toBe("fallback");
    expect(payload.purposes).toEqual(PRIVACY_PURPOSES);
    expect(payload.events).toEqual([]);
    expect(peekPrivacyPreferencesCache("u1")).toBe(payload);
  });

  it("reusa o cache na segunda chamada dentro do TTL", async () => {
    mockPrivacyFetch();
    const first = await loadPrivacyPreferences({ userId: "u1" });
    const second = await loadPrivacyPreferences({ userId: "u1" });
    expect(supabaseState.from).toHaveBeenCalledTimes(2);
    expect(second).toBe(first);
    expect(peekPrivacyPreferencesCache("u1")).toBe(first);
  });

  it("ignora o cache quando forceRefresh é true", async () => {
    mockPrivacyFetch();
    await loadPrivacyPreferences({ userId: "u1" });
    mockPrivacyFetch();
    await loadPrivacyPreferences({ userId: "u1", forceRefresh: true });
    expect(supabaseState.from).toHaveBeenCalledTimes(4);
  });

  it("expira o peek depois do TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T00:00:00.000Z"));
    mockPrivacyFetch();
    await loadPrivacyPreferences({ userId: "u1" });
    expect(peekPrivacyPreferencesCache("u1")).not.toBeNull();
    vi.setSystemTime(new Date("2026-09-15T00:00:00.000Z").getTime() + PRIVACY_PREFERENCES_CACHE_TTL_MS + 1);
    expect(peekPrivacyPreferencesCache("u1")).toBeNull();
    vi.useRealTimers();
  });

  it("deduplica fetches concorrentes enquanto o primeiro está em voo", async () => {
    const pending = {};
    mockPrivacyFetch({ pending });
    const first = loadPrivacyPreferences({ userId: "u1" });
    const second = loadPrivacyPreferences({ userId: "u1" });
    expect(supabaseState.from).toHaveBeenCalledTimes(2);
    pending.resolve();
    expect((await first).purposes[0].purpose_code).toBe("F-01");
    expect((await second).purposes[0].purpose_code).toBe("F-01");
    expect(supabaseState.from).toHaveBeenCalledTimes(2);
  });

  it("savePrivacyDecision invalida o cache", async () => {
    mockPrivacyFetch();
    await loadPrivacyPreferences({ userId: "u1" });
    expect(peekPrivacyPreferencesCache("u1")).not.toBeNull();
    supabaseState.rpc.mockResolvedValue({ data: { id: "e1" }, error: null });
    await savePrivacyDecision({ purposeCode: "F-01", eventType: "notice" });
    expect(peekPrivacyPreferencesCache("u1")).toBeNull();
  });
});
