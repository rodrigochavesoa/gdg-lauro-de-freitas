import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PrefetchIntentProvider } from "./PrefetchIntentProvider.jsx";

describe("PrefetchIntentProvider", () => {
  it("prefetches only same-origin intent links for the matching data family", () => {
    const jobs = vi.fn();
    const applications = vi.fn();
    const privacy = vi.fn();
    render(
      <MemoryRouter>
        <PrefetchIntentProvider jobs={jobs} applications={applications} privacy={privacy}>
          <Link to="/vagas">Vagas</Link>
          <Link to="/jobs/job-1">Detalhe</Link>
          <Link to="/minhas-candidaturas">Candidaturas</Link>
          <Link to="/preferencias">Privacidade</Link>
          <a href="https://example.com/vagas">Externo</a>
          <Link to="/preferencias" aria-disabled="true">Desabilitado</Link>
        </PrefetchIntentProvider>
      </MemoryRouter>,
    );

    fireEvent.pointerOver(screen.getByRole("link", { name: "Vagas" }));
    fireEvent.focusIn(screen.getByRole("link", { name: "Detalhe" }));
    fireEvent.pointerOver(screen.getByRole("link", { name: "Candidaturas" }));
    fireEvent.focusIn(screen.getByRole("link", { name: "Privacidade" }));
    fireEvent.pointerOver(screen.getByRole("link", { name: "Externo" }));
    fireEvent.focusIn(screen.getByRole("link", { name: "Desabilitado" }));

    expect(jobs).toHaveBeenCalledTimes(2);
    expect(applications).toHaveBeenCalledTimes(1);
    expect(privacy).toHaveBeenCalledTimes(1);
  });
});
