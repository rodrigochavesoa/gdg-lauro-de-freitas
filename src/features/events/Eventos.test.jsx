import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Eventos } from "./Eventos.jsx";
import { DEVFEST_2026 } from "./devfest-2026-content.js";

function renderEventos() {
  return render(
    <MemoryRouter>
      <Eventos />
    </MemoryRouter>,
  );
}

describe("Eventos", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renderiza as quatro zonas estáticas sem MarketingPageShell nem avatar DS-07", () => {
    renderEventos();

    const banner = screen.getByRole("img", { name: DEVFEST_2026.banner.alt });
    expect(banner).toHaveAttribute("src", DEVFEST_2026.banner.src);
    expect(banner).toHaveAttribute("loading", "eager");
    expect(banner).toHaveAttribute("decoding", "async");
    expect(banner.getAttribute("fetchpriority") ?? banner.getAttribute("fetchPriority")).toBe("high");

    expect(screen.getByRole("heading", { name: DEVFEST_2026.title })).toBeInTheDocument();
    expect(screen.getByText(DEVFEST_2026.datetimeLabel)).toBeInTheDocument();
    expect(screen.getByText(DEVFEST_2026.location)).toBeInTheDocument();
    expect(screen.getByText(DEVFEST_2026.format)).toBeInTheDocument();

    const register = screen.getByRole("link", { name: DEVFEST_2026.registerLabel });
    expect(register).toHaveAttribute("href", DEVFEST_2026.registerUrl);
    expect(register).toHaveAttribute("target", "_blank");
    expect(register).toHaveAttribute("rel", "noopener noreferrer");
    expect(register).toHaveClass("primary");

    expect(screen.getByRole("heading", { name: DEVFEST_2026.aboutTitle })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /BUILD \(Construir\)/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /SECURE \(Proteger\)/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /SCALE \(Escalar\)/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: DEVFEST_2026.moreInfoLabel })).toHaveAttribute(
      "href",
      DEVFEST_2026.moreInfoUrl,
    );

    expect(screen.getByRole("heading", { name: "Organizado por" })).toBeInTheDocument();
    expect(screen.getByText(DEVFEST_2026.organizer.name)).toBeInTheDocument();

    const contact = screen.getByRole("link", { name: "Entrar em contato" });
    const instagram = screen.getByRole("link", { name: "Instagram" });
    const linkedin = screen.getByRole("link", { name: "LinkedIn" });
    expect(contact).toHaveAttribute("href", "mailto:gdglaurodefreitas@gmail.com");
    expect(contact).toHaveClass("outline");
    expect(instagram).toHaveAttribute("href", "https://www.instagram.com/gdglauro/");
    expect(instagram).toHaveAttribute("target", "_blank");
    expect(linkedin).toHaveAttribute("href", "https://www.linkedin.com/in/gdg-lauro-de-freitas-a9a743313");
    expect(linkedin).toHaveClass("outline");

    expect(document.querySelector(".hero")).toBeTruthy();
    expect(document.querySelector(".home-divider__curve")).toBeTruthy();
    expect(document.querySelector(".event-layout")).toBeTruthy();
    expect(document.querySelector("main.event-landing")).toBeNull();
    expect(document.querySelector(".marketing-page")).toBeNull();
    expect(document.querySelector(".home-divider__avatar")).toBeNull();
    expect(document.querySelector(".cta")).toBeNull();
    expect(document.querySelector(".job-card--skeleton")).toBeNull();
    expect(screen.queryByText(/Carregando/i)).not.toBeInTheDocument();
  });

  it("não dispara fetch no mount", () => {
    const spy = vi.spyOn(globalThis, "fetch");
    renderEventos();
    expect(spy).not.toHaveBeenCalled();
  });
});
