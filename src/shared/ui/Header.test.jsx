import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "./Header.jsx";

function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="pathname">{pathname}</div>;
}

function renderHeader({ path = "/", ...props } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Header {...props} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function placeholderLabels(root = document) {
  return [...root.querySelectorAll(".nav-link-placeholder")].map((el) => el.textContent);
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
    const desktopNav = document.querySelector(".topbar nav");
    expect(within(desktopNav).getAllByRole("link").map((el) => el.textContent)).toEqual([
      "Vagas",
      "Eventos",
      "Newsletter",
      "Minhas candidaturas",
      "Privacidade",
    ]);
    expect(within(desktopNav).getByRole("link", { name: "Minhas candidaturas" })).toHaveAttribute("href", "/minhas-candidaturas");
    expect(within(desktopNav).queryByRole("link", { name: "Área admin" })).not.toBeInTheDocument();
    expect(within(desktopNav).queryByRole("link", { name: "Para empresas" })).not.toBeInTheDocument();
    expect(within(desktopNav).queryByRole("link", { name: "Comunidade" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    const mobile = document.getElementById("mobile-navigation");
    expect(within(mobile).getByRole("link", { name: "Minhas candidaturas" })).toHaveAttribute("href", "/minhas-candidaturas");
    expect(within(mobile).getByRole("link", { name: "Privacidade" })).toHaveAttribute("href", "/preferencias");
    expect(within(mobile).queryByRole("link", { name: "Área admin" })).not.toBeInTheDocument();
    expect(within(mobile).queryByRole("link", { name: "Para empresas" })).not.toBeInTheDocument();
    expect(within(mobile).queryByRole("link", { name: "Comunidade" })).not.toBeInTheDocument();
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

  it("fecha o menu móvel com Escape e devolve o foco ao botão", () => {
    renderHeader({ logged: false });
    const open = screen.getByRole("button", { name: "Abrir menu" });
    fireEvent.click(open);
    expect(document.getElementById("mobile-navigation")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.getElementById("mobile-navigation")).toBeNull();
    expect(screen.getByRole("button", { name: "Abrir menu" })).toHaveFocus();
  });

  it("com perfil incompleto bloqueia nav e brand sem mudar a rota nem marcar item ativo", () => {
    renderHeader({
      logged: true,
      displayName: "Ada Demo",
      role: "candidate",
      needsOnboarding: true,
      path: "/onboarding",
    });
    const desktopNav = document.querySelector(".topbar nav");
    const vagas = within(desktopNav).getByRole("link", { name: "Vagas" });
    expect(vagas).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "Ir para a página inicial" })).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(vagas);
    fireEvent.click(vagas);
    fireEvent.click(within(desktopNav).getByRole("link", { name: "Eventos" }));
    fireEvent.click(screen.getByRole("link", { name: "Ir para a página inicial" }));
    expect(screen.getByTestId("pathname")).toHaveTextContent("/onboarding");
    expect(vagas).not.toHaveClass("active");
    expect(within(desktopNav).getByRole("link", { name: "Eventos" })).not.toHaveClass("active");
    expect(screen.getByRole("status")).toHaveTextContent("Complete o perfil");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("link", { name: "Continuar" })).toHaveAttribute("href", "/onboarding");
    expect(document.querySelector(".nav-actions .eyebrow")).toBeNull();
    expect(document.querySelector(".nav-actions .nav-gate-notice")).toBeNull();
    expect(document.querySelector(".nav-gate-notice")).toBeTruthy();
  });

  it("antes de authReady reserva o slot do CTA sem avatar nem Entrar", () => {
    renderHeader({ logged: false, authReady: false, path: "/" });
    expect(screen.queryByRole("link", { name: "Entrar ou criar conta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sair/i })).not.toBeInTheDocument();
    const spacer = document.querySelector(".nav-actions__spacer");
    expect(spacer).toBeTruthy();
    expect(spacer).toHaveAttribute("aria-hidden", "true");
    expect(spacer).toHaveClass("primary", "small", "hide-mobile");
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    const mobile = document.getElementById("mobile-navigation");
    expect(within(mobile).queryByRole("link", { name: "Entrar ou criar conta" })).not.toBeInTheDocument();
  });

  it("com sessão e perfil ainda hidratando reserva placeholders sem links de papel", () => {
    renderHeader({ logged: true, displayName: "Ana Demo", authReady: true });
    expect(screen.getByRole("button", { name: "Ana Demo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sair/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Entrar ou criar conta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Minhas candidaturas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Privacidade" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Área admin" })).not.toBeInTheDocument();
    expect(document.querySelector(".nav-actions__spacer")).toBeNull();
    const desktopNav = document.querySelector(".topbar nav");
    expect(placeholderLabels(desktopNav)).toEqual(["Minhas candidaturas", "Privacidade"]);
    expect(desktopNav.querySelector(".nav-link-placeholder")).toHaveAttribute("aria-hidden", "true");
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    const mobile = document.getElementById("mobile-navigation");
    expect(placeholderLabels(mobile)).toEqual([]);
    expect(within(mobile).queryByRole("link", { name: "Minhas candidaturas" })).not.toBeInTheDocument();
    expect(within(mobile).queryByRole("link", { name: "Área admin" })).not.toBeInTheDocument();
    expect(within(mobile).getByRole("link", { name: "Vagas" })).toBeInTheDocument();
  });

  it("troca placeholders por links de candidato com fade-in quando o role chega", () => {
    const pending = { logged: true, displayName: "Ana Demo", authReady: true };
    const { rerender } = render(
      <MemoryRouter>
        <Header {...pending} />
      </MemoryRouter>,
    );
    expect(placeholderLabels(document.querySelector(".topbar nav"))).toEqual(["Minhas candidaturas", "Privacidade"]);

    rerender(
      <MemoryRouter>
        <Header {...pending} {...{ role: "candidate" }} />
      </MemoryRouter>,
    );

    const desktopNav = document.querySelector(".topbar nav");
    expect(placeholderLabels(desktopNav)).toEqual([]);
    const candidaturas = within(desktopNav).getByRole("link", { name: "Minhas candidaturas" });
    const privacidade = within(desktopNav).getByRole("link", { name: "Privacidade" });
    expect(candidaturas).toHaveClass("nav-link--hydrate");
    expect(privacidade).toHaveClass("nav-link--hydrate");
    expect(within(desktopNav).queryByRole("link", { name: "Área admin" })).not.toBeInTheDocument();
  });

  it("staff hidratado não vê links nem placeholders de candidato", () => {
    const pending = { logged: true, displayName: "Ada Admin", authReady: true };
    const { rerender } = render(
      <MemoryRouter>
        <Header {...pending} />
      </MemoryRouter>,
    );
    expect(placeholderLabels(document.querySelector(".topbar nav"))).toEqual(["Minhas candidaturas", "Privacidade"]);

    rerender(
      <MemoryRouter>
        <Header {...pending} {...{ role: "admin" }} />
      </MemoryRouter>,
    );

    const desktopNav = document.querySelector(".topbar nav");
    expect(placeholderLabels(desktopNav)).toEqual([]);
    expect(within(desktopNav).queryByRole("link", { name: "Minhas candidaturas" })).not.toBeInTheDocument();
    expect(within(desktopNav).queryByRole("link", { name: "Privacidade" })).not.toBeInTheDocument();
    expect(within(desktopNav).getByRole("link", { name: "Área admin" })).toHaveAttribute("href", "/admin");
  });

  it("candidato já hidratado no primeiro paint não anima os links", () => {
    renderHeader({ logged: true, displayName: "Ana Demo", role: "candidate" });
    const desktopNav = document.querySelector(".topbar nav");
    expect(within(desktopNav).getByRole("link", { name: "Minhas candidaturas" })).not.toHaveClass("nav-link--hydrate");
    expect(placeholderLabels(desktopNav)).toEqual([]);
  });

  it("mostra foto circular quando há avatarUrl e cai nas iniciais se a imagem falhar", () => {
    renderHeader({
      logged: true,
      displayName: "Ana Demo",
      role: "candidate",
      email: "ana@example.invalid",
      avatarUrl: "https://signed.example/u1",
    });
    const trigger = screen.getByRole("button", { name: "Ana Demo" });
    const photo = trigger.querySelector("img");
    expect(photo).toHaveAttribute("src", "https://signed.example/u1");
    fireEvent.error(photo);
    expect(trigger.querySelector("img")).toBeNull();
    expect(trigger).toHaveTextContent("AD");
  });

  it("abre o popover no clique, fecha com Escape e devolve o foco", () => {
    renderHeader({
      logged: true,
      displayName: "Ana Demo",
      role: "candidate",
      email: "ana@example.invalid",
    });
    const trigger = screen.getByRole("button", { name: "Ana Demo" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Ana Demo" });
    expect(within(dialog).getByRole("link", { name: "Minhas candidaturas" })).toHaveAttribute("href", "/minhas-candidaturas");
    expect(within(dialog).getByRole("link", { name: "Privacidade" })).toHaveAttribute("href", "/preferencias");
    expect(within(dialog).getByRole("button", { name: "Alterar foto" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Sair/i })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

const CROP_BLOB_URL = "blob:https://preview.test/avatar";

describe("Header crop dialog", () => {
  let OriginalImage;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    OriginalImage = globalThis.Image;
    URL.createObjectURL = vi.fn(() => CROP_BLOB_URL);
    URL.revokeObjectURL = vi.fn();
    class FakeImage {
      constructor() {
        this.onload = null;
        this.onerror = null;
        this._src = "";
      }
      set src(value) {
        this._src = value;
        queueMicrotask(() => this.onload?.());
      }
      get src() {
        return this._src;
      }
    }
    globalThis.Image = FakeImage;
  });

  afterEach(() => {
    cleanup();
    globalThis.Image = OriginalImage;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  async function pickAvatar() {
    fireEvent.change(screen.getByLabelText("Enviar foto de perfil"), {
      target: { files: [new File(["x"], "foto.jpg", { type: "image/jpeg" })] },
    });
    return screen.findByRole("dialog", { name: "Recortar foto" });
  }

  it("coloca o blob URL no img do diálogo depois de escolher o arquivo", async () => {
    renderHeader({
      logged: true,
      displayName: "Ana Demo",
      role: "candidate",
      email: "ana@example.invalid",
    });
    const dialog = await pickAvatar();
    expect(dialog.querySelector("img")).toHaveAttribute("src", CROP_BLOB_URL);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("revoga o object URL se o Header desmontar com o diálogo aberto", async () => {
    const view = renderHeader({
      logged: true,
      displayName: "Ana Demo",
      role: "candidate",
      email: "ana@example.invalid",
    });
    await pickAvatar();
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(CROP_BLOB_URL);
  });
});
