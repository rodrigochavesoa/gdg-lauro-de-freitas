import { describe, expect, it } from "vitest";
import { adminNavItemsForRole, isAdminNavItemActive, ADMIN_NAV_ITEMS } from "./admin-nav-items.js";

describe("admin-nav-items", () => {
  it("admin vê todas as seções", () => {
    expect(adminNavItemsForRole("admin").map((i) => i.label)).toEqual([
      "Painel",
      "Curadoria",
      "Comunidade",
      "Vagas",
      "Nova vaga",
      "Ingestão",
    ]);
  });

  it("curator e moderator recebem Comunidade além de Painel e Curadoria", () => {
    for (const role of ["curator", "moderator"]) {
      expect(adminNavItemsForRole(role).map((i) => i.label)).toEqual(["Painel", "Curadoria", "Comunidade"]);
    }
  });

  it("Comunidade fica ativa na lista e no perfil aberto dentro do admin", () => {
    const community = ADMIN_NAV_ITEMS.find((item) => item.id === "community");
    expect(isAdminNavItemActive("/admin/comunidade", community)).toBe(true);
    expect(isAdminNavItemActive("/admin/comunidade/member-1", community)).toBe(true);
    expect(isAdminNavItemActive("/comunidade", community)).toBe(false);
  });

  it("Vagas ativa na lista e no detalhe, não em Nova vaga", () => {
    const jobs = ADMIN_NAV_ITEMS.find((i) => i.id === "jobs");
    expect(isAdminNavItemActive("/admin/vagas", jobs)).toBe(true);
    expect(isAdminNavItemActive("/admin/vagas/j1", jobs)).toBe(true);
    expect(isAdminNavItemActive("/admin/vagas/nova", jobs)).toBe(false);
  });

  it("Nova vaga ativa só em /admin/vagas/nova", () => {
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
