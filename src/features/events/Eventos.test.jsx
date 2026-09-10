import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventosIndex } from "./Eventos.jsx";
import { EVENTS, EVENTS_INDEX } from "./events-catalog.js";

function renderIndex(props) {
  return render(
    <MemoryRouter>
      <EventosIndex {...props} />
    </MemoryRouter>,
  );
}

describe("EventosIndex", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T19:00:00-03:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("lista dois eventos estáticos no shell da Home sem avatar DS-07", () => {
    renderIndex();

    expect(document.querySelector(".hero")).toBeTruthy();
    expect(document.querySelector(".home-divider__curve")).toBeTruthy();
    expect(document.querySelector(".home-divider__avatar")).toBeNull();
    expect(document.querySelector(".event-banner")).toBeNull();
    expect(document.querySelector(".marketing-page")).toBeNull();
    expect(document.querySelector(".job-card--skeleton")).toBeNull();
    expect(document.querySelector(".jobs-layout")).toBeTruthy();
    expect(document.querySelector(".searchbox")).toBeTruthy();

    expect(screen.getByRole("heading", { level: 1, name: EVENTS_INDEX.title })).toBeInTheDocument();
    expect(screen.getByText(EVENTS_INDEX.lead)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Evento, cidade ou organizador")).toBeInTheDocument();
    expect(screen.getByText("2 eventos encontrados")).toBeInTheDocument();

    const cards = document.querySelectorAll(".event-index-card");
    expect(cards).toHaveLength(2);
    const wraps = document.querySelectorAll(".event-index-card__thumb-wrap");
    const thumbs = document.querySelectorAll(".event-index-card__thumb");
    expect(wraps).toHaveLength(2);
    expect(thumbs).toHaveLength(2);
    expect(document.querySelector(".event-index-card__thumb--contain")).toBeNull();
    thumbs.forEach((thumb) => {
      expect(thumb).toHaveClass("event-index-card__thumb");
      expect(thumb).not.toHaveClass("event-index-card__thumb--contain");
    });

    const viewLinks = screen.getAllByRole("link", { name: EVENTS_INDEX.viewEventLabel });
    expect(viewLinks).toHaveLength(EVENTS.length);
    expect(viewLinks[0]).toHaveAttribute("href", `/eventos/${EVENTS[0].slug}`);
    expect(viewLinks[1]).toHaveAttribute("href", `/eventos/${EVENTS[1].slug}`);
    expect(screen.getByRole("heading", { name: EVENTS[0].title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: EVENTS[1].title })).toBeInTheDocument();
    expect(document.querySelectorAll(".event-index-card .featured")).toHaveLength(2);
    expect(
      [...document.querySelectorAll(".event-index-card .featured")].map((node) => node.textContent),
    ).toEqual(["Em breve", "Em breve"]);
    expect(screen.getByRole("checkbox", { name: "Em breve" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Presencial" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Híbrido" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Online" })).toBeInTheDocument();
    expect(document.querySelector(".cta")).toBeTruthy();
  });

  it("liga Criar perfil gratuito à rota de login", () => {
    renderIndex();

    const cta = screen.getByRole("link", { name: EVENTS_INDEX.ctaAction });
    expect(cta).toHaveAttribute("href", "/login");
    expect(cta).toHaveClass("white-button");
    expect(screen.getByText(EVENTS_INDEX.ctaLead)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /O evento termina/i })).toBeInTheDocument();
  });

  it("não mostra a seção CTA quando o visitante já está logado", () => {
    renderIndex({ logged: true });

    expect(screen.queryByRole("link", { name: EVENTS_INDEX.ctaAction })).not.toBeInTheDocument();
    expect(document.querySelector(".cta")).toBeNull();
    expect(document.querySelector(".hero")).toBeTruthy();
    expect(document.querySelector(".jobs-layout")).toBeTruthy();
  });

  it("filtra o catálogo pela busca e mostra estado vazio", () => {
    renderIndex();

    const search = screen.getByPlaceholderText("Evento, cidade ou organizador");
    fireEvent.change(search, { target: { value: "Salvador" } });
    expect(screen.getByRole("heading", { name: EVENTS[1].title })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: EVENTS[0].title })).not.toBeInTheDocument();
    expect(screen.getByText("1 eventos encontrados")).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "evento-inexistente" } });
    expect(screen.getByRole("heading", { name: "Nenhum evento encontrado" })).toBeInTheDocument();
    expect(document.querySelector(".empty")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: EVENTS[0].title })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: EVENTS[1].title })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByRole("heading", { name: EVENTS[0].title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: EVENTS[1].title })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Online" }));
    expect(screen.getByRole("heading", { name: "Nenhum evento encontrado" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Híbrido" }));
    expect(screen.getByRole("heading", { name: "Nenhum evento encontrado" })).toBeInTheDocument();
  });

  it("não dispara fetch no mount", () => {
    const spy = vi.spyOn(globalThis, "fetch");
    renderIndex();
    expect(spy).not.toHaveBeenCalled();
  });
});
