import { describe, expect, it } from "vitest";
import { homologSupabaseHostnameError, isLoopbackHostname, loopbackBaseUrlError } from "./measure-target.mjs";

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
});
