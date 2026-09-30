import { describe, expect, it } from "vitest";
import {
  classifyLatency,
  detailContentSample,
  documentMayStoreSession,
  homologSupabaseHostnameError,
  loopbackBaseUrlError,
  loopbackOriginError,
  measurePreflightError,
  measureRuns,
  measureRunsError,
  sampleCountError,
  validDetailLatencies,
} from "./measure-target.mjs";
import { cacheDelta, opsEventFromConsole, probeBackendError, safeFailureText, sanitizeCacheStats, supabaseHostError, unsettledRows } from "./measure-observe.mjs";

describe("destinos da medição local", () => {
  it("aceita só o hostname exato de homolog", () => {
    expect(homologSupabaseHostnameError("https://pcdfxnfhgdmzmcmlhxuv.supabase.co")).toBe("");
    expect(homologSupabaseHostnameError("https://pcdfxnfhgdmzmcmlhxuv.attacker.example")).not.toBe("");
    expect(homologSupabaseHostnameError("https://pcdfxnfhgdmzmcmlhxuv.supabase.co.attacker.example")).not.toBe("");
    expect(homologSupabaseHostnameError("http://pcdfxnfhgdmzmcmlhxuv.supabase.co")).not.toBe("");
    expect(homologSupabaseHostnameError("https://user:secret@pcdfxnfhgdmzmcmlhxuv.supabase.co")).not.toBe("");
  });

  it("aceita BASE_URL só em loopback", () => {
    expect(loopbackBaseUrlError("http://127.0.0.1:5173")).toBe("");
    expect(loopbackBaseUrlError("http://localhost:5173")).toBe("");
    expect(loopbackBaseUrlError("http://[::1]:5173")).toBe("");
    expect(loopbackBaseUrlError("https://evil.example")).not.toBe("");
    expect(loopbackBaseUrlError("http://127.0.0.1.evil.example")).not.toBe("");
    expect(loopbackBaseUrlError("https://pcdfxnfhgdmzmcmlhxuv.supabase.co")).not.toBe("");
  });

  it("exige a origem exata, inclusive a porta", () => {
    expect(loopbackOriginError("http://127.0.0.1:5173/vagas", "http://127.0.0.1:5173")).toBe("");
    expect(loopbackOriginError("http://localhost:4173/", "http://localhost:5173")).not.toBe("");
    expect(loopbackOriginError("http://[::1]:5173/", "http://[::1]:5173")).toBe("");
    expect(documentMayStoreSession("http://[::1]:5173", "http://[::1]:5173")).toBe(true);
    expect(documentMayStoreSession("http://127.0.0.1:5173", "http://localhost:5173")).toBe(false);
  });

  it("rejeita MEASURE_RUNS que não é inteiro positivo e amostra curta", () => {
    expect(measureRunsError("")).toBe("");
    expect(measureRuns(undefined)).toBe(5);
    expect(measureRuns("3")).toBe(3);
    expect(measureRunsError("abc")).not.toBe("");
    expect(measureRunsError("0")).not.toBe("");
    expect(measureRunsError("1.5")).not.toBe("");
    expect(measureRunsError("21")).not.toBe("");
    expect(measureRunsError("100")).not.toBe("");
    expect(measureRunsError("9007199254740993")).not.toBe("");
    expect(measureRunsError("20")).toBe("");
    expect(measureRuns("abc")).toBe(0);
    expect(measurePreflightError({
      supabaseUrl: "https://pcdfxnfhgdmzmcmlhxuv.supabase.co",
      baseUrl: "http://127.0.0.1:5173",
      measureRuns: "5",
    })).toBe("");
    expect(sampleCountError([1, 2, 3, 4, 5], 5, "portal cold")).toBe("");
    expect(sampleCountError([], 5, "portal cold")).not.toBe("");
  });

  it("não trata ausência de REST como hit e não aceita correlação fora do formato", () => {
    expect(opsEventFromConsole({
      event_name: "ops.search",
      route: "/vagas",
      action: "catalog_search",
      outcome: "success",
      error_class: "none",
      correlation_id: "0123456789ab",
    })?.correlation_id).toBe("0123456789ab");
    expect(opsEventFromConsole({ event_name: "ops.search", correlation_id: "user@example.com" })).toBeNull();
    expect(opsEventFromConsole({
      event_name: "ops.search",
      route: "/vagas?email=person@example.com",
      action: "catalog_search",
      outcome: "success",
      error_class: "none",
      correlation_id: "0123456789ab",
    })).toBeNull();
    expect(opsEventFromConsole({
      event_name: "ops.custom",
      route: "/vagas",
      action: "catalog_search",
      outcome: "success",
      error_class: "none",
      correlation_id: "0123456789ab",
    })).toBeNull();
    expect(opsEventFromConsole({
      event_name: "ops.search",
      route: "/vagas",
      action: "catalog_search",
      outcome: "success",
      error_class: "falha com detalhe livre",
      correlation_id: "0123456789ab",
    })).toBeNull();
    expect(unsettledRows([{ path: "jobs", status: 200 }, { path: "jobs", status: null }])).toEqual([
      { path: "jobs", settled: false },
    ]);
    expect(sanitizeCacheStats({ catalog: { hit: 1, miss: 0 }, "user-id": { hit: 1, miss: 0 } })).toEqual({
      catalog: { hit: 1, miss: 0 },
    });
    expect(cacheDelta({ catalog: { hit: 0, miss: 1 } }, { catalog: { hit: 1, miss: 1 } })).toEqual({
      catalog: { hit: 1, miss: 0 },
    });
    expect(probeBackendError(null)).not.toBe("");
    expect(probeBackendError({ supabaseUrl: "https://pcdfxnfhgdmzmcmlhxuv.supabase.co" })).toBe("");
    expect(probeBackendError({ supabaseUrl: "https://other-project.supabase.co" })).not.toBe("");
    expect(supabaseHostError("https://other-project.supabase.co/rest/v1/jobs")).not.toBe("");
    expect(supabaseHostError("https://pcdfxnfhgdmzmcmlhxuv.supabase.co/rest/v1/jobs")).toBe("");
    expect(safeFailureText("net::ERR_CONNECTION_REFUSED at https://secret.example/?token=abc")).toBe("net::ERR_CONNECTION_REFUSED");
  });

  it("não transforma timeout de conteúdo em latência e separa fora do teto", () => {
    expect(detailContentSample(30_000, false)).toEqual({ reached: false });
    expect(detailContentSample(1048, true)).toEqual({ reached: true, ms: 1048 });
    expect(validDetailLatencies([
      detailContentSample(1048, true),
      detailContentSample(30_000, false),
    ])).toEqual([1048]);
    expect(classifyLatency({ validN: 5, expectedN: 5, p95: 383, limitMs: 250 })).toBe("fora do teto");
    expect(classifyLatency({ validN: 5, expectedN: 5, p95: 122, limitMs: 250 })).toBe("medido");
    expect(classifyLatency({ validN: 4, expectedN: 5, p95: 1048, limitMs: 1500 })).toBe("hipótese");
  });
});
