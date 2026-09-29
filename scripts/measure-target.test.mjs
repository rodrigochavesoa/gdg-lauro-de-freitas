import { describe, expect, it } from "vitest";
import {
  documentMayStoreSession,
  homologSupabaseHostnameError,
  isLoopbackHostname,
  loopbackBaseUrlError,
  loopbackOriginError,
  measureRuns,
  measureRunsError,
  sampleCountError,
} from "./measure-target.mjs";

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
    expect(isLoopbackHostname("127.0.0.1")).toBe(true);
    expect(isLoopbackHostname("attacker.example")).toBe(false);
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
    expect(measureRuns("abc")).toBe(0);
    expect(sampleCountError([1, 2, 3, 4, 5], 5, "portal cold")).toBe("");
    expect(sampleCountError([], 5, "portal cold")).not.toBe("");
  });
});
