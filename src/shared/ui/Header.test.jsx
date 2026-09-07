import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Header } from "./Header.jsx";

function renderHeader({ path = "/", ...props } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Header {...props} />
    </MemoryRouter>,
  );
}

describe("Header", () => {
  it("anon na home tem um CTA Entrar ou criar conta", () => {
    renderHeader({ logged: false, path: "/" });
    const cta = screen.getByRole("link", { name: "Entrar ou criar conta" });
    expect(cta).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("link", { name: /^Entrar$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Criar conta$/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Área admin" })).toHaveAttribute("href", "/admin");
    expect(screen.queryByRole("link", { name: "Para empresas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Comunidade" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    const mobile = document.getElementById("mobile-navigation");
    expect(within(mobile).getByRole("link", { name: "Entrar ou criar conta" })).toHaveAttribute("href", "/login");
  });

  it("anon em /login não mostra CTAs de auth no Header", () => {
    renderHeader({ logged: false, path: "/login" });
    expect(screen.queryByRole("link", { name: "Entrar ou criar conta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Entrar$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Criar conta$/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    const mobile = document.getElementById("mobile-navigation");
    expect(within(mobile).queryByRole("link", { name: "Entrar ou criar conta" })).not.toBeInTheDocument();
    expect(within(mobile).getByRole("link", { name: "Vagas" })).toBeInTheDocument();
  });

  it("anon em /admin não mostra CTAs de auth no Header", () => {
    renderHeader({ logged: false, path: "/admin" });
    expect(screen.queryByRole("link", { name: "Entrar ou criar conta" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Área admin" })).toHaveAttribute("href", "/admin");
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    const mobile = document.getElementById("mobile-navigation");
    expect(within(mobile).queryByRole("link", { name: "Entrar ou criar conta" })).not.toBeInTheDocument();
  });

  it("candidato logado vê Minhas candidaturas e não vê Área admin", () => {
    renderHeader({ logged: true, displayName: "Ana Demo", role: "candidate" });
    expect(screen.getByRole("link", { name: "Minhas candidaturas" })).toHaveAttribute("href", "/minhas-candidaturas");
    expect(screen.queryByRole("link", { name: "Área admin" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Para empresas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Comunidade" })).toBeInTheDocument();
  });

  it("staff logado vê Área admin e não vê Minhas candidaturas", () => {
    renderHeader({ logged: true, displayName: "Ada Admin", role: "admin" });
    expect(screen.getByRole("link", { name: "Área admin" })).toHaveAttribute("href", "/admin");
    expect(screen.queryByRole("link", { name: "Minhas candidaturas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Para empresas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Comunidade" })).not.toBeInTheDocument();
  });

  it("curador logado também usa Área admin sem nav de candidato", () => {
    renderHeader({ logged: true, displayName: "Cora Curadora", role: "curator" });
    expect(screen.getByRole("link", { name: "Área admin" })).toHaveAttribute("href", "/admin");
    expect(screen.queryByRole("link", { name: "Minhas candidaturas" })).not.toBeInTheDocument();
  });
});
