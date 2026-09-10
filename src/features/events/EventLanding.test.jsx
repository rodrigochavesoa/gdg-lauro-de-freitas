import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventLanding } from "./EventLanding.jsx";
import { DEVFEST_2026 } from "./devfest-2026-content.js";
import { DEVOPSDAYS_SALVADOR_2026 } from "./devopsdays-salvador-2026-content.js";

function renderLanding(event, initialEntry = "/eventos/evento") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/eventos" element={<p>indice-eventos</p>} />
        <Route path="/eventos/:slug" element={<EventLanding event={event} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("EventLanding", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renderiza as quatro zonas do DevFest sem MarketingPageShell nem avatar DS-07", () => {
    renderLanding(DEVFEST_2026);

    const banner = screen.getByRole("img", { name: DEVFEST_2026.banner.alt });
    const bannerWrap = banner.closest(".event-banner-wrap");
    expect(banner).toHaveAttribute("src", DEVFEST_2026.banner.src);
    expect(banner).toHaveClass("event-banner");
    expect(banner).not.toHaveClass("event-banner--portrait");
    expect(bannerWrap).toHaveClass("event-banner-wrap", "event-banner-wrap--seamless");
    expect(banner).toHaveAttribute("loading", "eager");
    expect(banner.getAttribute("fetchpriority") ?? banner.getAttribute("fetchPriority")).toBe("high");

    expect(screen.getByRole("heading", { name: DEVFEST_2026.title })).toBeInTheDocument();
    expect(screen.getByText(DEVFEST_2026.datetimeLabel)).toBeInTheDocument();
    expect(screen.getByText(DEVFEST_2026.format)).toBeInTheDocument();

    const register = screen.getByRole("link", { name: DEVFEST_2026.registerLabel });
    expect(register).toHaveAttribute("href", DEVFEST_2026.registerUrl);
    expect(register).toHaveAttribute("target", "_blank");
    expect(register).toHaveAttribute("rel", "noopener noreferrer");

    expect(screen.getByRole("heading", { name: /BUILD \(Construir\)/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /SECURE \(Proteger\)/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /SCALE \(Escalar\)/ })).toBeInTheDocument();
    expect(screen.getByText(DEVFEST_2026.organizer.name)).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /Voltar para eventos/i })).toHaveClass("back");
    expect(document.querySelector(".event-layout > .back")).toBeTruthy();
    expect(document.querySelector(".hero")).toBeTruthy();
    expect(document.querySelector(".home-divider__curve")).toBeTruthy();
    expect(document.querySelector(".home-divider__avatar")).toBeNull();
    expect(document.querySelector(".marketing-page")).toBeNull();
  });

  it("renderiza DevOpsDays com banner panorâmico sem distorção, CTA de tickets e organizador", () => {
    renderLanding(DEVOPSDAYS_SALVADOR_2026);

    const banner = screen.getByRole("img", { name: DEVOPSDAYS_SALVADOR_2026.banner.alt });
    const bannerWrap = banner.closest(".event-banner-wrap");
    expect(banner).toHaveAttribute("src", DEVOPSDAYS_SALVADOR_2026.banner.src);
    expect(banner).toHaveAttribute("height", "312");
    expect(banner).toHaveClass("event-banner--portrait");
    expect(bannerWrap).toHaveClass("event-banner-wrap", "event-banner-wrap--seamless");
    expect(bannerWrap).toHaveClass("event-banner-wrap--wide");

    expect(screen.getByRole("heading", { name: DEVOPSDAYS_SALVADOR_2026.title })).toBeInTheDocument();
    expect(screen.getByText(DEVOPSDAYS_SALVADOR_2026.datetimeLabel)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /BUILD \(Construir\)/ })).not.toBeInTheDocument();

    const tickets = screen.getByRole("link", { name: DEVOPSDAYS_SALVADOR_2026.registerLabel });
    expect(tickets).toHaveAttribute("href", DEVOPSDAYS_SALVADOR_2026.registerUrl);
    expect(tickets).toHaveAttribute("target", "_blank");
    expect(tickets).toHaveAttribute("rel", "noopener noreferrer");

    expect(screen.getByText(DEVOPSDAYS_SALVADOR_2026.organizer.name)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar em contato" })).toHaveAttribute(
      "href",
      "mailto:salvador@devopsdays.org",
    );
    expect(screen.getByRole("link", { name: "Instagram" })).toHaveAttribute(
      "href",
      "https://www.instagram.com/devopsdayssalvador/",
    );
    expect(screen.getByRole("link", { name: DEVOPSDAYS_SALVADOR_2026.moreInfoLabel })).toHaveAttribute(
      "href",
      DEVOPSDAYS_SALVADOR_2026.moreInfoUrl,
    );

    expect(screen.getByRole("button", { name: /Voltar para eventos/i })).toHaveClass("back");
    expect(document.querySelector(".event-layout > .back")).toBeTruthy();
    expect(document.querySelector(".home-divider__curve")).toBeTruthy();
    expect(document.querySelector(".home-divider__avatar")).toBeNull();
  });

  it("volta para o índice /eventos ao clicar em Voltar para eventos", () => {
    renderLanding(DEVOPSDAYS_SALVADOR_2026, "/eventos/devopsdays-salvador-2026");
    fireEvent.click(screen.getByRole("button", { name: /Voltar para eventos/i }));
    expect(screen.getByText("indice-eventos")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: DEVOPSDAYS_SALVADOR_2026.title })).not.toBeInTheDocument();
  });

  it("não dispara fetch no mount", () => {
    const spy = vi.spyOn(globalThis, "fetch");
    renderLanding(DEVOPSDAYS_SALVADOR_2026);
    expect(spy).not.toHaveBeenCalled();
  });
});
