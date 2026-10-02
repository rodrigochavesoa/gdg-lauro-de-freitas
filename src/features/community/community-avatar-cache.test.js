import { afterEach, describe, expect, it, vi } from "vitest";
import {
  communityAvatarObjectUrl,
  peekCommunityAvatarObjectUrl,
  revokeCommunityAvatarObjectUrls,
} from "./community-avatar-cache.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function mockObjectUrls() {
  const created = [];
  const revoked = [];
  class MockURL extends URL {
    static createObjectURL(blob) {
      const url = `blob:community-test-${created.length + 1}`;
      created.push({ blob, url });
      return url;
    }

    static revokeObjectURL(url) {
      revoked.push(url);
    }
  }
  vi.stubGlobal("URL", MockURL);
  return { created, revoked };
}

describe("community avatar cache", () => {
  afterEach(() => {
    revokeCommunityAvatarObjectUrls();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not cache or announce a Blob when its request resolves after revoke", async () => {
    const { created } = mockObjectUrls();
    const request = deferred();
    const loadUrl = vi.fn(() => request.promise);
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    const oldCaller = communityAvatarObjectUrl("profile-1", loadUrl);
    await Promise.resolve();
    revokeCommunityAvatarObjectUrls();
    request.resolve(new Blob(["stale avatar"], { type: "image/jpeg" }));

    await expect(oldCaller).rejects.toThrow(/preview de avatar indisponível/i);
    expect(peekCommunityAvatarObjectUrl("profile-1")).toBeNull();
    expect(created).toHaveLength(0);
    expect(dispatchSpy.mock.calls.filter(([event]) => event.type === "community-avatar-cache")).toHaveLength(0);
  });

  it("allows a fresh Blob read after revoke and caches its ObjectURL", async () => {
    const { created } = mockObjectUrls();
    const oldRequest = deferred();
    const newRequest = deferred();
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const staleBlob = new Blob(["stale avatar"], { type: "image/jpeg" });
    const freshBlob = new Blob(["fresh avatar"], { type: "image/jpeg" });

    const oldCaller = communityAvatarObjectUrl("profile-2", () => oldRequest.promise);
    await Promise.resolve();
    revokeCommunityAvatarObjectUrls();

    const freshCaller = communityAvatarObjectUrl("profile-2", () => newRequest.promise);
    await Promise.resolve();
    oldRequest.resolve(staleBlob);
    newRequest.resolve(freshBlob);

    await expect(oldCaller).rejects.toThrow(/preview de avatar indisponível/i);
    await expect(freshCaller).resolves.toBe("blob:community-test-1");
    expect(peekCommunityAvatarObjectUrl("profile-2")).toBe("blob:community-test-1");
    expect(created).toEqual([{ blob: freshBlob, url: "blob:community-test-1" }]);
    expect(dispatchSpy.mock.calls.filter(([event]) => event.type === "community-avatar-cache")).toHaveLength(1);
    expect(dispatchSpy.mock.calls.find(([event]) => event.type === "community-avatar-cache")?.[0])
      .toEqual(expect.objectContaining({ detail: { publicId: "profile-2" } }));
  });

  it("rejects URL strings and other non-Blob values", async () => {
    mockObjectUrls();
    await expect(communityAvatarObjectUrl("profile-3", async () => "https://example.test/avatar.jpg"))
      .rejects.toThrow(/preview de avatar indisponível/i);
    await expect(communityAvatarObjectUrl("profile-4", async () => null))
      .rejects.toThrow(/preview de avatar indisponível/i);
    expect(peekCommunityAvatarObjectUrl("profile-3")).toBeNull();
    expect(peekCommunityAvatarObjectUrl("profile-4")).toBeNull();
  });
});
