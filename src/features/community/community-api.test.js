import { describe, expect, it, vi } from "vitest";
import {
  COMMUNITY_PAGE_SIZE,
  loadCommunityProfile,
  loadMyCommunityPublicationStatus,
  getCommunityAvatar,
  listCommunityProfiles,
  revokeCommunityProfile,
  setMyCommunityPublication,
} from "./community-api.js";

function fakeClient({ session = { user: { id: "private-auth-id" }, access_token: "test-access-token" }, rpcData = [], rpcError = null } = {}) {
  const rpc = vi.fn(async () => ({ data: rpcData, error: rpcError }));
  const getSession = vi.fn(async () => ({ data: { session }, error: null }));
  return { auth: { getSession }, rpc, functions: { invoke: vi.fn() } };
}

describe("community API seam", () => {
  it("does not issue a profile read without an authenticated session", async () => {
    const client = fakeClient({ session: null });

    await expect(listCommunityProfiles({}, client)).rejects.toThrow(/Entre na sua conta/i);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("exposes the closed F-11 status without reading profile rows", async () => {
    const client = fakeClient({ rpcData: { available: false, reason: "approval_pending", published: false } });

    await expect(loadMyCommunityPublicationStatus(client)).resolves.toEqual({
      published: false,
      canPublish: false,
      reasonCode: "approval_pending",
    });
    expect(client.rpc).toHaveBeenCalledWith("get_community_feature_status");
    expect(client.rpc.mock.calls.flat()).not.toContain("profiles");
  });

  it("uses a bounded page and maps list results through the public DTO", async () => {
    const client = fakeClient({
      rpcData: [{
        public_id: "2e2fbaf7-e292-4c5d-8b77-928639845e01",
        full_name: "Ana Example",
        headline: "Dev",
        skills: [],
        location: null,
        experience_level: null,
        work_model: null,
        avatar_available: false,
        published_at: "2026-10-01T12:00:00.000Z",
        email: "never-map@example.test",
      }],
    });

    const result = await listCommunityProfiles({ limit: 999 }, client);

    expect(client.rpc).toHaveBeenCalledWith("list_community_profiles", {
      p_limit: COMMUNITY_PAGE_SIZE,
      p_before_id: null,
      p_before_published_at: null,
    });
    expect(result.items[0]).not.toHaveProperty("email");
  });

  it("validates opaque identifiers before making a detail request", async () => {
    const client = fakeClient();

    await expect(loadCommunityProfile("not-a-public-id", client)).rejects.toThrow(/não encontrado/i);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("uses only the authenticated avatar proxy and does not fetch it without a session", async () => {
    const visitor = fakeClient({ session: null });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(getCommunityAvatar("2e2fbaf7-e292-4c5d-8b77-928639845e01", visitor)).rejects.toThrow(/Entre na sua conta/i);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();

    import.meta.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    import.meta.env.VITE_SUPABASE_ANON_KEY = "anon-key";
    const client = fakeClient();
    const fetchSpyOk = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["image"], { type: "image/jpeg" }),
    });
    await getCommunityAvatar("2e2fbaf7-e292-4c5d-8b77-928639845e01", client);
    expect(fetchSpyOk).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/community-avatar?publicId=2e2fbaf7-e292-4c5d-8b77-928639845e01",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-access-token",
          apikey: expect.any(String),
        }),
      }),
    );
    fetchSpyOk.mockRestore();
  });

  it("sends publish and revoke through self-scoped RPCs, never table writes", async () => {
    const client = fakeClient({ rpcData: true });

    await expect(setMyCommunityPublication(true, client)).resolves.toBe(true);
    await expect(revokeCommunityProfile(client)).resolves.toBe(false);

    expect(client.rpc).toHaveBeenNthCalledWith(1, "set_community_profile_publication", { p_published: true });
    expect(client.rpc).toHaveBeenNthCalledWith(2, "set_community_profile_publication", { p_published: false });
  });
});
