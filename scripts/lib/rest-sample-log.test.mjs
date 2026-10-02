import { describe, expect, it } from "vitest";
import { carriedTimingFor, createRestSampleLog, restTimingRecord } from "./rest-sample-log.mjs";

function request(id) {
  return { id };
}

describe("rest sample log", () => {
  it("separa a chegada dos headers do fim do corpo", () => {
    const log = createRestSampleLog();
    const applications = request("slow-body");
    log.onRequest(applications, "applications", 1_000);
    log.onResponse(applications, { status: 200, at: 1_100, headerBytes: null });
    expect(log.inflightRequests()).toEqual([applications]);
    expect(restTimingRecord(log.entryFor(applications), 1_000)).toMatchObject({
      responseOffsetMs: 100,
      endOffsetMs: null,
      bytes: null,
    });

    log.onFinished(applications, { at: 1_600, bodyBytes: 48 });
    expect(log.inflightRequests()).toEqual([]);
    expect(restTimingRecord(log.entryFor(applications), 1_000)).toMatchObject({
      status: 200,
      bytes: 48,
      responseOffsetMs: 100,
      endOffsetMs: 600,
    });
  });

  it("não troca respostas simultâneas do mesmo caminho", () => {
    const log = createRestSampleLog();
    const first = request("first");
    const second = request("second");
    log.onRequest(first, "applications", 0);
    log.onRequest(second, "applications", 10);
    log.onResponse(second, { status: 201, at: 20, headerBytes: 12 });
    log.onFinished(second, { at: 30 });
    log.onResponse(first, { status: 200, at: 40, headerBytes: 80 });
    log.onFinished(first, { at: 90 });

    expect(log.entryFor(first)).toMatchObject({ status: 200, bytes: 80, responseAt: 40, finishedAt: 90 });
    expect(log.entryFor(second)).toMatchObject({ status: 201, bytes: 12, responseAt: 20, finishedAt: 30 });
    expect(carriedTimingFor(log, [first], 15)).toEqual([
      expect.objectContaining({
        path: "applications",
        status: 200,
        bytes: 80,
        startOffsetMs: -15,
        responseOffsetMs: 25,
        endOffsetMs: 75,
      }),
    ]);
  });
});
