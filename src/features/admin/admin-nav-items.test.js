import { describe, expect, it } from "vitest";
import { adminNavItemsForRole, isAdminNavItemActive, ADMIN_NAV_ITEMS } from "./admin-nav-items.js";

describe("admin-nav-items", () => {
  it("admin vê todas as seções", () => {
    expect(adminNavItemsForRole("admin").map((i) => i.label)).toEqual([
      "Painel",
      "Curadoria",
      "Vagas",
      "Publicar",
      "Ingestão",
    ]);
  });

  it("curator e moderator só Painel e Curadoria", () => {
    for (const role of ["curator", "moderator"]) {
      expect(adminNavItemsForRole(role).map((i) => i.label)).toEqual(["Painel", "Curadoria"]);
    }
  });

  it("Vagas ativa na lista e no detalhe, não em Publicar", () => {
    const jobs = ADMIN_NAV_ITEMS.find((i) => i.id === "jobs");
    expect(isAdminNavItemActive("/admin/vagas", jobs)).toBe(true);
    expect(isAdminNavItemActive("/admin/vagas/j1", jobs)).toBe(true);
    expect(isAdminNavItemActive("/admin/vagas/nova", jobs)).toBe(false);
  });

  it("Publicar ativa só em /admin/vagas/nova", () => {
    const publish = ADMIN_NAV_ITEMS.find((i) => i.id === "publish");
    expect(isAdminNavItemActive("/admin/vagas/nova", publish)).toBe(true);
    expect(isAdminNavItemActive("/admin/vagas", publish)).toBe(false);
    expect(isAdminNavItemActive("/admin/vagas/j1", publish)).toBe(false);
  });

  it("Painel só na raiz /admin", () => {
    const panel = ADMIN_NAV_ITEMS.find((i) => i.id === "panel");
    expect(isAdminNavItemActive("/admin", panel)).toBe(true);
    expect(isAdminNavItemActive("/admin/curadoria", panel)).toBe(false);
  });
});
