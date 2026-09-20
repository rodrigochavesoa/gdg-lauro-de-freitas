import { describe, expect, it } from "vitest";
import { canManageAdminJobs, isAdminAreaPath, isStaffRole, toCurationProfile } from "./staff-access.js";

describe("staff-access", () => {
  it("reconhece papéis staff atuais sem ampliar o conjunto", () => {
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole("curator")).toBe(true);
    expect(isStaffRole("moderator")).toBe(true);
    expect(isStaffRole("candidate")).toBe(false);
    expect(isStaffRole(undefined)).toBe(false);
  });

  it("restringe gestão de vagas ao admin", () => {
    expect(canManageAdminJobs("admin")).toBe(true);
    expect(canManageAdminJobs("curator")).toBe(false);
    expect(canManageAdminJobs("moderator")).toBe(false);
    expect(canManageAdminJobs("candidate")).toBe(false);
  });

  it("monta perfil de curadoria só com sessão staff", () => {
    const session = { user: { id: "a1", email: "ada@example.invalid" } };
    expect(toCurationProfile({ id: "a1", role: "admin", full_name: "Ada" }, session)).toEqual({
      id: "a1",
      full_name: "Ada",
      role: "admin",
      email: "ada@example.invalid",
    });
    expect(toCurationProfile({ role: "candidate" }, session)).toBeNull();
    expect(toCurationProfile({ role: "admin" }, null)).toBeNull();
  });

  it("identifica a área admin incluindo deep links", () => {
    expect(isAdminAreaPath("/admin")).toBe(true);
    expect(isAdminAreaPath("/admin/curadoria")).toBe(true);
    expect(isAdminAreaPath("/admin/vagas/nova")).toBe(true);
    expect(isAdminAreaPath("/login")).toBe(false);
    expect(isAdminAreaPath("/vagas")).toBe(false);
  });
});
