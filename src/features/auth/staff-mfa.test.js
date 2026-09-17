import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supabaseState = vi.hoisted(() => ({
  enabled: true,
  getAuthenticatorAssuranceLevel: vi.fn(),
  listFactors: vi.fn(),
  enroll: vi.fn(),
  challenge: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("../../lib/supabase-client.js", () => ({
  getSupabaseBrowserClient: () =>
    supabaseState.enabled
      ? {
          auth: {
            mfa: {
              getAuthenticatorAssuranceLevel: supabaseState.getAuthenticatorAssuranceLevel,
              listFactors: supabaseState.listFactors,
              enroll: supabaseState.enroll,
              challenge: supabaseState.challenge,
              verify: supabaseState.verify,
            },
          },
        }
      : null,
}));

import {
  enrollStaffTotp,
  getStaffMfaAssurance,
  isStaffMfaRequired,
  needsStaffMfaStep,
  verifyStaffTotp,
} from "./staff-mfa.js";

describe("staff-mfa", () => {
  beforeEach(() => {
    supabaseState.enabled = true;
    supabaseState.getAuthenticatorAssuranceLevel.mockReset();
    supabaseState.listFactors.mockReset();
    supabaseState.enroll.mockReset();
    supabaseState.challenge.mockReset();
    supabaseState.verify.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("só exige MFA quando a flag é exatamente true", () => {
    expect(isStaffMfaRequired(undefined)).toBe(false);
    expect(isStaffMfaRequired("")).toBe(false);
    expect(isStaffMfaRequired("false")).toBe(false);
    expect(isStaffMfaRequired("TRUE")).toBe(false);
    expect(isStaffMfaRequired("1")).toBe(false);
    expect(isStaffMfaRequired("true")).toBe(true);
    vi.stubEnv("VITE_STAFF_MFA_REQUIRED", "true");
    expect(isStaffMfaRequired()).toBe(true);
  });

  it("bloqueia o passo MFA enquanto o nível não for aal2", () => {
    expect(needsStaffMfaStep(null)).toBe(false);
    expect(needsStaffMfaStep({ currentLevel: "aal2" })).toBe(false);
    expect(needsStaffMfaStep({ currentLevel: "aal1", nextLevel: "aal2" })).toBe(true);
    expect(needsStaffMfaStep({ currentLevel: "aal1", nextLevel: "aal1" })).toBe(true);
  });

  it("consulta AAL e fatores TOTP verificados", async () => {
    supabaseState.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    });
    supabaseState.listFactors.mockResolvedValue({
      data: {
        totp: [
          { id: "unverified", status: "unverified" },
          { id: "totp-1", status: "verified" },
        ],
      },
      error: null,
    });
    await expect(getStaffMfaAssurance()).resolves.toEqual({
      currentLevel: "aal1",
      nextLevel: "aal2",
      verifiedTotp: [{ id: "totp-1", status: "verified" }],
    });
  });

  it("inscreve TOTP e devolve QR e segredo sem exigir SMS", async () => {
    supabaseState.enroll.mockResolvedValue({
      data: {
        id: "factor-1",
        totp: { qr_code: "data:image/svg+xml,qr", secret: "SECRETBASE32" },
      },
      error: null,
    });
    await expect(enrollStaffTotp()).resolves.toEqual({
      factorId: "factor-1",
      qrCode: "data:image/svg+xml,qr",
      secret: "SECRETBASE32",
    });
    expect(supabaseState.enroll).toHaveBeenCalledWith({
      factorType: "totp",
      friendlyName: "GDG Jobs",
    });
  });

  it("confirma o desafio TOTP com o código informado", async () => {
    supabaseState.challenge.mockResolvedValue({ data: { id: "challenge-1" }, error: null });
    supabaseState.verify.mockResolvedValue({ data: { access_token: "t" }, error: null });
    await verifyStaffTotp({ factorId: "factor-1", code: " 123456 " });
    expect(supabaseState.challenge).toHaveBeenCalledWith({ factorId: "factor-1" });
    expect(supabaseState.verify).toHaveBeenCalledWith({
      factorId: "factor-1",
      challengeId: "challenge-1",
      code: "123456",
    });
  });

  it("falha fechado sem cliente Supabase", async () => {
    supabaseState.enabled = false;
    await expect(getStaffMfaAssurance()).rejects.toThrow(/não configuradas/);
  });
});
