import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventLanding } from "./EventLanding.jsx";
import { DEVFEST_2026 } from "./devfest-2026-content.js";
import { DEVOPSDAYS_SALVADOR_2026 } from "./devopsdays-salvador-2026-content.js";

function renderLanding(event) {
  return render(
    <MemoryRouter>
      <EventLanding event={event} />
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
    expect(banner).toHaveAttribute("src", DEVFEST_2026.banner.src);
    expect(banner).toHaveClass("event-banner");
    expect(banner).not.toHaveClass("event-banner--portrait");
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

    expect(document.querySelector(".hero")).toBeTruthy();
    expect(document.querySelector(".home-divider__curve")).toBeTruthy();
    expect(document.querySelector(".home-divider__avatar")).toBeNull();
    expect(document.querySelector(".marketing-page")).toBeNull();
  });

  it("renderiza DevOpsDays com banner vertical, CTA de tickets e organizador", () => {
    renderLanding(DEVOPSDAYS_SALVADOR_2026);

    const banner = screen.getByRole("img", { name: DEVOPSDAYS_SALVADOR_2026.banner.alt });
    expect(banner).toHaveAttribute("src", DEVOPSDAYS_SALVADOR_2026.banner.src);
    expect(banner).toHaveClass("event-banner--portrait");

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

    expect(document.querySelector(".home-divider__curve")).toBeTruthy();
    expect(document.querySelector(".home-divider__avatar")).toBeNull();
  });

  it("não dispara fetch no mount", () => {
    const spy = vi.spyOn(globalThis, "fetch");
    renderLanding(DEVOPSDAYS_SALVADOR_2026);
    expect(spy).not.toHaveBeenCalled();
  });
});
