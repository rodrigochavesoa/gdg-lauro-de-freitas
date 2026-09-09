import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventosIndex } from "./Eventos.jsx";
import { EVENTS, EVENTS_INDEX } from "./events-catalog.js";

function renderIndex() {
  return render(
    <MemoryRouter>
      <EventosIndex />
    </MemoryRouter>,
  );
}

describe("EventosIndex", () => {
  afterEach(() => {
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

    expect(screen.getByRole("heading", { level: 1, name: EVENTS_INDEX.title })).toBeInTheDocument();
    expect(screen.getByText(EVENTS_INDEX.lead)).toBeInTheDocument();

    const cards = document.querySelectorAll(".event-index-card");
    expect(cards).toHaveLength(2);

    const viewLinks = screen.getAllByRole("link", { name: EVENTS_INDEX.viewEventLabel });
    expect(viewLinks).toHaveLength(EVENTS.length);
    expect(viewLinks[0]).toHaveAttribute("href", `/eventos/${EVENTS[0].slug}`);
    expect(viewLinks[1]).toHaveAttribute("href", `/eventos/${EVENTS[1].slug}`);
    expect(screen.getByRole("heading", { name: EVENTS[0].title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: EVENTS[1].title })).toBeInTheDocument();
  });

  it("não dispara fetch no mount", () => {
    const spy = vi.spyOn(globalThis, "fetch");
    renderIndex();
    expect(spy).not.toHaveBeenCalled();
  });
});
