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
    const spacer = document.querySelector(".nav-actions__spacer");
    expect(spacer).toBeTruthy();
    expect(spacer).toHaveAttribute("aria-hidden", "true");
    expect(spacer).toHaveClass("hide-mobile");
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    const mobile = document.getElementById("mobile-navigation");
    expect(within(mobile).queryByRole("link", { name: "Entrar ou criar conta" })).not.toBeInTheDocument();
    expect(within(mobile).getByRole("link", { name: "Vagas" })).toBeInTheDocument();
  });

  it("anon em /admin não mostra CTAs de auth no Header e reserva slot do CTA", () => {
    renderHeader({ logged: false, path: "/admin" });
    expect(screen.queryByRole("link", { name: "Entrar ou criar conta" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Área admin" })).toHaveAttribute("href", "/admin");
    const spacer = document.querySelector(".nav-actions__spacer");
    expect(spacer).toBeTruthy();
    expect(spacer).toHaveAttribute("aria-hidden", "true");
    expect(spacer).toHaveClass("primary", "small", "hide-mobile");
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

  it("menu principal lista Vagas, Eventos e Newsletter no desktop e no mobile", () => {
    renderHeader({ logged: false });
    const desktopNav = document.querySelector(".topbar nav");
    const desktopLinks = within(desktopNav).getAllByRole("link").map((el) => el.textContent);
    expect(desktopLinks.slice(0, 3)).toEqual(["Vagas", "Eventos", "Newsletter"]);
    expect(within(desktopNav).getByRole("link", { name: "Eventos" })).toHaveAttribute("href", "/eventos");
    expect(within(desktopNav).getByRole("link", { name: "Newsletter" })).toHaveAttribute("href", "/newsletter");
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    const mobile = document.getElementById("mobile-navigation");
    const mobileLinks = within(mobile).getAllByRole("link").map((el) => el.textContent);
    expect(mobileLinks.slice(0, 3)).toEqual(["Vagas", "Eventos", "Newsletter"]);
    expect(within(mobile).getByRole("link", { name: "Eventos" })).toHaveAttribute("href", "/eventos");
    expect(within(mobile).getByRole("link", { name: "Newsletter" })).toHaveAttribute("href", "/newsletter");
  });

  it("marca Eventos como ativo em /eventos sem marcar Vagas", () => {
    renderHeader({ logged: false, path: "/eventos" });
    const desktopNav = document.querySelector(".topbar nav");
    expect(within(desktopNav).getByRole("link", { name: "Eventos" })).toHaveClass("active");
    expect(within(desktopNav).getByRole("link", { name: "Vagas" })).not.toHaveClass("active");
    expect(within(desktopNav).getByRole("link", { name: "Newsletter" })).not.toHaveClass("active");
  });

  it("mantém Eventos ativo no slug de um evento", () => {
    renderHeader({ logged: false, path: "/eventos/devopsdays-salvador-2026" });
    const desktopNav = document.querySelector(".topbar nav");
    expect(within(desktopNav).getByRole("link", { name: "Eventos" })).toHaveClass("active");
    expect(within(desktopNav).getByRole("link", { name: "Vagas" })).not.toHaveClass("active");
  });

  it("marca Newsletter como ativo em /newsletter sem marcar Vagas", () => {
    renderHeader({ logged: false, path: "/newsletter" });
    const desktopNav = document.querySelector(".topbar nav");
    expect(within(desktopNav).getByRole("link", { name: "Newsletter" })).toHaveClass("active");
    expect(within(desktopNav).getByRole("link", { name: "Vagas" })).not.toHaveClass("active");
    expect(within(desktopNav).getByRole("link", { name: "Eventos" })).not.toHaveClass("active");
  });

  it("candidato e staff continuam com a nav de papel após Eventos e Newsletter", () => {
    const { unmount } = renderHeader({ logged: true, displayName: "Ana Demo", role: "candidate" });
    expect(screen.getByRole("link", { name: "Eventos" })).toHaveAttribute("href", "/eventos");
    expect(screen.getByRole("link", { name: "Newsletter" })).toHaveAttribute("href", "/newsletter");
    expect(screen.getByRole("link", { name: "Minhas candidaturas" })).toBeInTheDocument();
    unmount();
    renderHeader({ logged: true, displayName: "Ada Admin", role: "admin" });
    expect(screen.getByRole("link", { name: "Eventos" })).toHaveAttribute("href", "/eventos");
    expect(screen.getByRole("link", { name: "Newsletter" })).toHaveAttribute("href", "/newsletter");
    expect(screen.getByRole("link", { name: "Área admin" })).toHaveAttribute("href", "/admin");
  });
});
