import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AdminNav } from "./AdminNav.jsx";

function renderNav(role, path = "/admin") {
  render(<MemoryRouter initialEntries={[path]}><AdminNav profile={{ role }} /></MemoryRouter>);
  return screen.getByRole("navigation", { name: "Seções da área administrativa" });
}

describe("AdminNav Sprint 20A", () => {
  beforeEach(() => window.localStorage.clear());

  it("admin tem os cinco destinos e o ativo é anunciado", () => {
    const nav = renderNav("admin", "/admin/ingestao");
    expect(within(nav).getAllByRole("link")).toHaveLength(5);
    expect(within(nav).getByRole("link", { name: "Ingestão" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Vagas" })).not.toHaveAttribute("aria-current");
  });

  it("curator não recebe destinos exclusivos do admin", () => {
    const nav = renderNav("curator", "/admin/curadoria");
    expect(within(nav).getAllByRole("link")).toHaveLength(2);
    expect(within(nav).queryByRole("link", { name: "Ingestão" })).not.toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Curadoria" })).toHaveAttribute("aria-current", "page");
  });

  it("em Nova vaga não marca Vagas como seção ativa", () => {
    const nav = renderNav("admin", "/admin/vagas/nova");
    expect(within(nav).getByRole("link", { name: "Nova vaga" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Vagas" })).not.toHaveAttribute("aria-current");
    expect(within(nav).getByRole("link", { name: "Vagas" })).not.toHaveClass("admin-sidebar__link--active");
  });

  it("recolhe sem perder nomes acessíveis e persiste apenas a preferência visual", () => {
    const nav = renderNav("admin");
    fireEvent.click(screen.getByRole("button", { name: "Recolher menu administrativo" }));
    expect(screen.getByRole("button", { name: "Expandir menu administrativo" })).toHaveAttribute("aria-expanded", "false");
    expect(within(nav).getByRole("link", { name: "Painel" })).toHaveAttribute("aria-current", "page");
    expect(window.localStorage.getItem("gdgjobs-admin-sidebar-collapsed")).toBe("true");
  });
});
