import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const cachedJob = {
  id: "1",
  title: "Pessoa Desenvolvedora Front-end",
  company: "Nuvem Lauro Demo",
  logo: "NL",
  color: "#4285f4",
  level: "Pleno",
  place: "Brasil · Remoto",
  type: "Remoto",
  posted: "há 2 dias",
  postedAt: "2026-09-05T12:00:00.000Z",
  stack: ["React"],
  salary: "A combinar",
  featured: false,
};

vi.mock("./jobs-api.js", () => ({
  peekApprovedJobsCache: () => [cachedJob],
  loadApprovedJobs: () => new Promise(() => {}),
}));

import { Home } from "./Home.jsx";

describe("Home", () => {
  it("não mostra skeleton quando o cache do catálogo já está preenchido", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(document.querySelector(".job-card--skeleton")).toBeNull();
    expect(screen.getByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vagas em destaque" })).toBeInTheDocument();
  });

  it("liga Criar perfil gratuito à rota de login", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /Criar perfil gratuito/i })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: /Criar perfil gratuito/i })).toHaveClass("white-button");
  });

  it("não mostra a seção CTA quando o visitante já está logado", () => {
    render(
      <MemoryRouter>
        <Home logged />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: /Criar perfil gratuito/i })).not.toBeInTheDocument();
    expect(document.querySelector(".cta")).toBeNull();
  });

  it("fecha o sheet de filtros pelo CTA e mantém a seleção", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    expect(screen.getByRole("dialog", { name: "Filtros" })).toHaveAttribute("aria-modal", "true");
    fireEvent.click(screen.getByRole("checkbox", { name: "Python" }));
    expect(screen.getByRole("heading", { name: "Nenhuma vaga encontrada" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver 0 resultados" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nenhuma vaga encontrada" })).toBeInTheDocument();
  });
});
