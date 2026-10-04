import { describe, expect, it } from "vitest";
import {
  classifyAvatarRequest,
  createCommunityAvatarRecorder,
  normalizeAvatarMethod,
  normalizeAvatarStatus,
} from "./community-avatar-metrics.mjs";

describe("community avatar metrics privacy and correlation", () => {
  it("classifies only fixed endpoints and never returns URL data", () => {
    const result = classifyAvatarRequest(
      "https://pcdfxnfhgdmzmcmlhxuv.supabase.co/functions/v1/community-avatar?publicId=secret-uuid&apikey=secret-key",
      "get",
    );
    expect(result).toEqual({ kind: "avatarGet", method: "GET" });
    expect(JSON.stringify(result)).not.toMatch(/secret|publicId|apikey|supabase\.co/);
    expect(classifyAvatarRequest("https://example.test/functions/v1/other?token=secret", "GET")).toBeNull();
    expect(classifyAvatarRequest("not a url?token=secret", "GET")).toBeNull();
  });

  it("normalizes methods and status codes into a closed vocabulary", () => {
    expect(normalizeAvatarMethod("options")).toBe("OPTIONS");
    expect(normalizeAvatarMethod("DELETE")).toBe("OTHER");
    expect(normalizeAvatarStatus(401)).toBe("unauthorized");
    expect(normalizeAvatarStatus(429)).toBe("rate_limited");
    expect(normalizeAvatarStatus(418)).toBe("other");
    expect(normalizeAvatarStatus("raw-error")).toBe("unknown");
  });

  it("keeps late responses and bodies in the phase that opened their request", async () => {
    let currentTime = 10;
    const recorder = createCommunityAvatarRecorder(() => currentTime);
    const request = {
      url: () => "https://pcdfxnfhgdmzmcmlhxuv.supabase.co/functions/v1/community-avatar?publicId=private-id",
      method: () => "GET",
    };
    recorder.onRequest(request, { run: 1, name: "list" });

    // A new phase is active when the previous navigation finally responds.
    currentTime = 55;
    recorder.onResponse({
      request: () => request,
      status: () => 200,
    });
    currentTime = 72;
    expect(recorder.recordBrowserEvent({
      type: "blobBody",
      run: 1,
      phase: "list",
      durationMs: 17,
      bodyBytes: 17,
      ok: true,
    })).toBe(true);

    const requestRows = recorder.snapshot({ run: 1, name: "list" }).requests;
    const requestRow = requestRows[0];
    expect(requestRow).toMatchObject({
      kind: "avatarGet",
      method: "GET",
      status: "ok",
      durationMs: 45,
      bodyDurationMs: null,
      bodyBytes: null,
    });
    expect(Object.keys(requestRow).sort()).toEqual([
      "bodyBytes", "bodyDurationMs", "durationMs", "kind", "method", "objectUrlToDecodeMs", "status",
    ]);
    expect(requestRows[1]).toMatchObject({
      kind: "avatarBlobBody",
      method: "OTHER",
      status: "ok",
      durationMs: null,
      bodyDurationMs: 17,
      bodyBytes: 17,
    });
    const serialized = JSON.stringify(recorder.snapshot({ run: 1, name: "list" }));
    expect(serialized).toContain('"bodyDurationMs":17');
    expect(serialized).toContain('"bodyBytes":17');
    expect(serialized).not.toMatch(/private-id|publicId|supabase\.co|apikey/);
    expect(recorder.snapshot({ run: 1, name: "detail" }).requests).toEqual([]);
  });

  it("accepts only safe browser measurement events and strips extra fields", () => {
    const recorder = createCommunityAvatarRecorder();
    expect(recorder.recordBrowserEvent({
      type: "objectUrl",
      run: 2,
      phase: "list",
      durationMs: 3.6,
      bodyBytes: 128,
      url: "blob:private-id",
      profile: "private name",
    })).toBe(true);
    expect(recorder.recordBrowserEvent({ type: "unexpected", run: 2, phase: "list", url: "secret" })).toBe(false);
    const output = JSON.stringify(recorder.snapshot({ run: 2, name: "list" }));
    expect(output).toContain('"bodyBytes":128');
    expect(output).toContain('"route":"communityList"');
    expect(output).not.toMatch(/private-id|private name|blob:|"url"|"profile"/);
  });
});
