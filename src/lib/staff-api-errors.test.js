import { describe, expect, it } from "vitest";
import {
  formatStaffCurationReviewError,
  formatStaffPrivilegedApiError,
  STAFF_API_ERROR_FALLBACK,
  throwStaffApiError,
} from "./staff-api-errors.js";

describe("staff-api-errors", () => {
  it("mapeia AAL2 e sessão expirada", () => {
    expect(formatStaffPrivilegedApiError("JWT does not contain aal2 claim")).toMatch(/Confirme o segundo fator/);
    expect(formatStaffPrivilegedApiError("JWT expired")).toMatch(/Sessão expirada/);
  });

  it("não ecoa PostgREST nem SQL desconhecidos", () => {
    const raw = "permission denied for table jobs";
    expect(formatStaffPrivilegedApiError(raw)).toBe(STAFF_API_ERROR_FALLBACK);
    expect(formatStaffPrivilegedApiError(raw)).not.toContain("permission denied");
    expect(formatStaffPrivilegedApiError("PGRST116")).toBe(STAFF_API_ERROR_FALLBACK);
    expect(formatStaffPrivilegedApiError("PGRST116")).not.toMatch(/PGRST116/);
    expect(() => throwStaffApiError({ message: raw })).toThrow(STAFF_API_ERROR_FALLBACK);
    try {
      throwStaffApiError({ message: raw });
    } catch (error) {
      expect(error.cause).toEqual({ message: raw });
    }
    expect(formatStaffPrivilegedApiError(STAFF_API_ERROR_FALLBACK)).toBe(STAFF_API_ERROR_FALLBACK);
  });

  it("mapeia falhas didáticas de submit_curation_review", () => {
    expect(formatStaffCurationReviewError("cannot review own submission")).toMatch(/enviada por você/i);
    expect(formatStaffCurationReviewError("already reviewed in this round")).toMatch(/já registrou parecer/i);
    expect(formatStaffCurationReviewError("job is not open for curation")).toMatch(/não está aberta/i);
    expect(formatStaffCurationReviewError("permission denied for table jobs")).toBe(STAFF_API_ERROR_FALLBACK);
    expect(formatStaffCurationReviewError("permission denied for table jobs")).not.toContain("permission");
  });
});
