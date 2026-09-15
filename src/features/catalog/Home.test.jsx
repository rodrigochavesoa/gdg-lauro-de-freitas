import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { filterJobs } from "../../lib/filter-jobs.js";

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

const extraJob = {
  ...cachedJob,
  id: "2",
  title: "Pessoa Engenheira de Dados",
  company: "Recife Dados Lab",
  stack: ["Python"],
};

const peekApprovedJobsPage = vi.hoisted(() => vi.fn());
const loadApprovedJobs = vi.hoisted(() => vi.fn());

vi.mock("./jobs-api.js", () => ({
  peekApprovedJobsPage: (...args) => peekApprovedJobsPage(...args),
  loadApprovedJobs: (...args) => loadApprovedJobs(...args),
  CATALOG_PAGE_SIZE: 24,
}));

import { Home } from "./Home.jsx";

function pageFor(options = {}) {
  const filtered = filterJobs([cachedJob], options);
  return { jobs: filtered, count: filtered.length };
}

describe("Home", () => {
  beforeEach(() => {
    peekApprovedJobsPage.mockReset();
    loadApprovedJobs.mockReset();
    peekApprovedJobsPage.mockImplementation((params) => {
      const query = params?.query ?? "";
      const tech = params?.tech ?? [];
      const level = params?.level ?? [];
      const workModel = params?.workModel ?? [];
      if (query || tech.length || level.length || workModel.length) return null;
      return { jobs: [cachedJob], count: 1 };
    });
    loadApprovedJobs.mockImplementation(async (options = {}) => pageFor(options));
  });

  it("não mostra skeleton quando o cache do catálogo já está preenchido", async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(document.querySelector(".job-card--skeleton")).toBeNull();
    expect(screen.getByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vagas em destaque" })).toBeInTheDocument();
    await waitFor(() => expect(loadApprovedJobs).toHaveBeenCalled());
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

  it("fecha o sheet de filtros pelo CTA e mantém a seleção", async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    expect(screen.getByRole("dialog", { name: "Filtros" })).toHaveAttribute("aria-modal", "true");
    fireEvent.click(screen.getByRole("checkbox", { name: "Python" }));
    expect(await screen.findByRole("heading", { name: "Nenhuma vaga encontrada" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver 0 resultados" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nenhuma vaga encontrada" })).toBeInTheDocument();
    expect(loadApprovedJobs).toHaveBeenCalledWith(expect.objectContaining({ tech: ["Python"], offset: 0 }));
  });

  it("liga o filtro de modelo de trabalho, marca o checkbox e zera no Limpar", async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Presencial" }));
    expect(screen.getByRole("checkbox", { name: "Presencial" })).toBeChecked();
    expect(await screen.findByRole("heading", { name: "Nenhuma vaga encontrada" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Filtros/ })).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(screen.getByRole("checkbox", { name: "Presencial" })).not.toBeChecked();
    expect(await screen.findByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(document.querySelector(".filter-mobile b")).toBeNull();

    fireEvent.click(screen.getByRole("checkbox", { name: "Remoto" }));
    expect(screen.getByRole("checkbox", { name: "Remoto" })).toBeChecked();
    expect(await screen.findByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Filtros/ })).toHaveTextContent("1");
    expect(loadApprovedJobs).toHaveBeenCalledWith(expect.objectContaining({ workModel: ["Remoto"], offset: 0 }));
  });

  it("usa o count do servidor no contador e carrega mais sem filtrar só a página", async () => {
    peekApprovedJobsPage.mockReturnValue({ jobs: [cachedJob], count: 25 });
    loadApprovedJobs.mockImplementation(async (options = {}) => {
      if ((options.offset ?? 0) > 0) return { jobs: [cachedJob, extraJob], count: 25 };
      return { jobs: [cachedJob], count: 25 };
    });

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByText("25 oportunidades encontradas")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Carregar mais" }));
    expect(await screen.findByRole("heading", { name: "Pessoa Engenheira de Dados" })).toBeInTheDocument();
    expect(loadApprovedJobs).toHaveBeenCalledWith(expect.objectContaining({ offset: 1 }));
  });

  it("carrega o avatar DS-07 eager com dimensões intrínsecas", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    const avatar = document.querySelector(".home-divider__avatar");
    expect(avatar).toHaveAttribute("src", "/avatar-gdgjobs.png");
    expect(avatar).toHaveAttribute("loading", "eager");
    expect(avatar).toHaveAttribute("width", "1169");
    expect(avatar).toHaveAttribute("height", "987");
    expect(avatar).not.toHaveAttribute("loading", "lazy");
  });
});
