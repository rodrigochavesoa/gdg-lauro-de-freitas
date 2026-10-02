import { describe, expect, it, vi } from "vitest";
import { createCommunityAvatarHandler } from "./handler.js";

const ORIGIN = "https://gdg.example.test";
const PUBLIC_ID = "2e2fbaf7-e292-4c5d-8b77-928639845e01";

function makeHandler(overrides = {}) {
  const authGetUser = vi.fn(async () => ({ data: { user: { id: "auth-user-1" } }, error: null }));
  const getStoragePath = vi.fn(async () => ({ data: "53c66d81-3481-4ac0-8bab-0b0c77dedf82/avatar.jpg", error: null }));
  const downloadImage = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { "content-type": "image/jpeg", "content-length": "3" },
  }));
  const handler = createCommunityAvatarHandler({
    allowedOrigins: [ORIGIN],
    verifyAccessToken: authGetUser,
    getPrivateAvatarPath: getStoragePath,
    downloadPrivateAvatar: downloadImage,
    ...overrides,
  });
  return { handler, authGetUser, getStoragePath, downloadImage };
}

describe("community-avatar authenticated proxy", () => {
  it("permite apenas o preflight esperado e os headers do Supabase JS", async () => {
    const { handler, authGetUser: verifyAccessToken } = makeHandler();
    const response = await handler(new Request("https://edge.example.test/community-avatar", {
      method: "OPTIONS",
      headers: {
        origin: ORIGIN,
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization, apikey, x-client-info",
      },
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(response.headers.get("access-control-allow-origin")).not.toBe("*");
    expect(response.headers.get("access-control-allow-headers")).toMatch(/x-client-info/i);
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it("nega preflight com método ou header fora da allowlist", async () => {
    const { handler } = makeHandler();
    const response = await handler(new Request("https://edge.example.test/community-avatar", {
      method: "OPTIONS",
      headers: {
        origin: ORIGIN,
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization, x-evil-header",
      },
    }));

    expect(response.status).toBe(403);
  });

  it("never mints or returns a signed URL, including when format=signed is requested", async () => {
    const createSignedAvatarUrl = vi.fn(async () => "https://storage.example.test/signed/avatar.jpg");
    const { handler, getStoragePath, downloadImage } = makeHandler({ createSignedAvatarUrl });
    const response = await handler(new Request(`https://edge.example.test/community-avatar?publicId=${PUBLIC_ID}&format=signed`, {
      headers: { authorization: "Bearer user-jwt", origin: ORIGIN },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.arrayBuffer()).toEqual(Uint8Array.from([1, 2, 3]).buffer);
    expect(createSignedAvatarUrl).not.toHaveBeenCalled();
    expect(getStoragePath).toHaveBeenCalledWith(PUBLIC_ID, "auth-user-1");
    expect(downloadImage).toHaveBeenCalledTimes(1);
  });

  it("returns bytes only for authenticated users and never serializes the storage path", async () => {
    const { handler, getStoragePath, downloadImage } = makeHandler();
    const response = await handler(new Request(`https://edge.example.test/community-avatar?publicId=${PUBLIC_ID}`, {
      headers: { authorization: "Bearer user-jwt", origin: ORIGIN },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("content-disposition")).toBe("inline");
    expect(response.headers.get("cross-origin-resource-policy")).toBeNull();
    expect(await response.arrayBuffer()).toEqual(Uint8Array.from([1, 2, 3]).buffer);
    expect(getStoragePath).toHaveBeenCalledWith(PUBLIC_ID, "auth-user-1");
    expect(downloadImage).toHaveBeenCalledWith("53c66d81-3481-4ac0-8bab-0b0c77dedf82/avatar.jpg");
  });

  it("rejects missing auth, bad origin, bad method, and invalid ids before storage access", async () => {
    const { handler, authGetUser: verifyAccessToken, getStoragePath: getPrivateAvatarPath } = makeHandler();
    const noAuth = await handler(new Request(`https://edge.example.test/community-avatar?publicId=${PUBLIC_ID}`, {
      headers: { origin: ORIGIN },
    }));
    const badOrigin = await handler(new Request(`https://edge.example.test/community-avatar?publicId=${PUBLIC_ID}`, {
      headers: { authorization: "Bearer user-jwt", origin: "https://attacker.example" },
    }));
    const badMethod = await handler(new Request("https://edge.example.test/community-avatar", {
      method: "POST", headers: { authorization: "Bearer user-jwt", origin: ORIGIN },
    }));
    const badId = await handler(new Request("https://edge.example.test/community-avatar?publicId=1", {
      headers: { authorization: "Bearer user-jwt", origin: ORIGIN },
    }));

    expect([noAuth.status, badOrigin.status, badMethod.status, badId.status]).toEqual([401, 403, 405, 400]);
    for (const response of [noAuth, badOrigin, badMethod, badId]) {
      const body = await response.text();
      expect(body).not.toContain("53c66d81-3481-4ac0-8bab-0b0c77dedf82/avatar.jpg");
      expect(body).not.toMatch(/signed|storage|avatar\.jpg/i);
    }
    expect(verifyAccessToken).not.toHaveBeenCalled();
    expect(getPrivateAvatarPath).not.toHaveBeenCalled();
  });

  it("does not return a path or reveal whether a private/unpublished profile exists", async () => {
    const { handler, downloadImage } = makeHandler({
      getPrivateAvatarPath: vi.fn(async () => ({ data: null, error: null })),
    });
    const response = await handler(new Request(`https://edge.example.test/community-avatar?publicId=${PUBLIC_ID}`, {
      headers: { authorization: "Bearer user-jwt", origin: ORIGIN },
    }));

    expect(response.status).toBe(404);
    expect(await response.text()).not.toMatch(/uid|path|avatar\.jpg|private/i);
    expect(downloadImage).not.toHaveBeenCalled();
  });

  it("rejects unsupported media and oversized images", async () => {
    const unsupported = makeHandler({
      downloadPrivateAvatar: vi.fn(async () => new Response("no", { headers: { "content-type": "text/html" } })),
    });
    const tooLarge = makeHandler({
      downloadPrivateAvatar: vi.fn(async () => new Response(new Uint8Array([1]), {
        headers: { "content-type": "image/jpeg", "content-length": "4000000" },
      })),
    });
    const request = () => new Request(`https://edge.example.test/community-avatar?publicId=${PUBLIC_ID}`, {
      headers: { authorization: "Bearer user-jwt", origin: ORIGIN },
    });

    expect((await unsupported.handler(request())).status).toBe(415);
    expect((await tooLarge.handler(request())).status).toBe(413);
  });

  it("does not stream beyond the byte limit when Storage omits content-length", async () => {
    const { handler } = makeHandler({
      downloadPrivateAvatar: vi.fn(async () => new Response(new Uint8Array(2 * 1024 * 1024 + 1), {
        headers: { "content-type": "image/jpeg" },
      })),
    });
    const response = await handler(new Request(`https://edge.example.test/community-avatar?publicId=${PUBLIC_ID}`, {
      headers: { authorization: "Bearer user-jwt", origin: ORIGIN },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    const reader = response.body.getReader();
    await expect(reader.read()).rejects.toThrow(/avatar response too large/i);
  });

  it("never passes a malformed database path to private Storage", async () => {
    const { handler, downloadImage } = makeHandler({
      getPrivateAvatarPath: vi.fn(async () => ({ data: "../../other-user/secret.jpg", error: null })),
    });
    const response = await handler(new Request(`https://edge.example.test/community-avatar?publicId=${PUBLIC_ID}`, {
      headers: { authorization: "Bearer user-jwt", origin: ORIGIN },
    }));

    expect(response.status).toBe(503);
    expect(downloadImage).not.toHaveBeenCalled();
    expect(await response.text()).not.toMatch(/secret|other-user|path/i);
  });
});
