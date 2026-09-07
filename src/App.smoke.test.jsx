import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const authState = {
  session: null,
  profile: null,
  needsOnboarding: false,
};

vi.mock("./features/auth/auth-api.js", () => ({
  loadAuthSnapshot: async () => authState,
  subscribeAuth: (onChange) => {
    onChange(authState);
    return () => {};
  },
  signOutUser: vi.fn(async () => {
    authState.session = null;
    authState.profile = null;
    authState.needsOnboarding = false;
  }),
  startGoogleOAuth: vi.fn(),
}));

const loadMyApplicationMock = vi.fn(async () => null);
const loadMyApplicationsMock = vi.fn(async () => []);

vi.mock("./features/jobs/apply-api.js", async () => {
  const actual = await vi.importActual("./features/jobs/apply-api.js");
  return {
    ...actual,
    applyToJob: vi.fn(),
    withdrawApplication: vi.fn(),
    loadMyApplication: (...args) => loadMyApplicationMock(...args),
    loadMyApplications: (...args) => loadMyApplicationsMock(...args),
  };
});

vi.mock("./features/catalog/jobs-api.js", () => ({
  loadApprovedJobs: async () => [
    {
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
      stack: ["React", "TypeScript", "Next.js"],
      salary: "A combinar",
      featured: false,
      description: "Fictícia",
      about: "Empresa fictícia",
      responsibilities: ["Construir interfaces"],
    },
    {
      id: "2",
      title: "Desenvolvedor(a) Back-end Node.js",
      company: "Baía Code Exemplo",
      logo: "BC",
      color: "#ea4335",
      level: "Júnior",
      place: "São Paulo, SP · Híbrido",
      type: "Híbrido",
      posted: "há 3 dias",
      postedAt: "2026-09-04T12:00:00.000Z",
      stack: ["Node.js"],
      salary: "A combinar",
      featured: false,
      description: "Fictícia",
      about: "Empresa fictícia",
      responsibilities: ["APIs"],
    },
    {
      id: "3",
      title: "Product Designer",
      company: "Costa Design Demo",
      logo: "CD",
      color: "#fbbc04",
      level: "Pleno",
      place: "Remoto",
      type: "Remoto",
      posted: "há 5 dias",
      postedAt: "2026-09-02T12:00:00.000Z",
      stack: ["Figma"],
      salary: "A combinar",
      featured: false,
      description: "Fictícia",
      about: "Empresa fictícia",
      responsibilities: ["Discovery"],
    },
    {
      id: "4",
      title: "Pessoa Engenheira de Dados",
      company: "Recife Dados Lab",
      logo: "RD",
      color: "#34a853",
      level: "Sênior",
      place: "Osasco, SP · Híbrido",
      type: "Híbrido",
      posted: "há 1 semana",
      postedAt: "2026-08-30T12:00:00.000Z",
      stack: ["Python"],
      salary: "A combinar",
      featured: false,
      description: "Fictícia",
      about: "Empresa fictícia",
      responsibilities: ["Pipelines"],
    },
  ],
  loadApprovedJob: async (id) => ({
    id,
    title: "Pessoa Desenvolvedora Front-end",
    company: "Nuvem Lauro Demo",
    logo: "NL",
    color: "#4285f4",
    level: "Pleno",
    place: "Brasil · Remoto",
    type: "Remoto",
    posted: "há 2 dias",
    stack: ["React", "TypeScript", "Next.js"],
    salary: "A combinar",
    featured: false,
    description: "Fictícia",
    about: "Empresa fictícia",
    responsibilities: ["Construir interfaces"],
  }),
}));

import { App } from "./App.jsx";
import { THEME_STORAGE_KEY } from "./shared/ui/theme.js";

beforeEach(() => {
  authState.session = null;
  authState.profile = null;
  authState.needsOnboarding = false;
  localStorage.removeItem(THEME_STORAGE_KEY);
  document.documentElement.setAttribute("data-theme", "system");
  loadMyApplicationMock.mockReset();
  loadMyApplicationMock.mockResolvedValue(null);
  loadMyApplicationsMock.mockReset();
  loadMyApplicationsMock.mockResolvedValue([]);
});

async function renderAt(path = "/") {
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

async function renderHome() {
  await renderAt("/");
  await waitFor(() => {
    expect(screen.getByText("4 oportunidades encontradas")).toBeInTheDocument();
  });
}

describe("ARQ-01 — caracterização do shell", () => {
  it("renderiza a home com busca e listagem de vagas aprovadas", async () => {
    await renderHome();
    expect(screen.getByRole("heading", { name: /carreira em tech/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Cargo, tecnologia ou empresa")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
  });

  it("abre o menu de ordenação e lista as vagas mais antigas", async () => {
    await renderHome();
    const trigger = screen.getByRole("button", { name: /Mais recentes/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("option", { name: "Mais antigas" }));
    expect(screen.getByRole("button", { name: /Mais antigas/i })).toHaveAttribute("aria-expanded", "false");
    const titles = screen.getAllByRole("article").map((card) => within(card).getByRole("heading").textContent);
    expect(titles[0]).toBe("Pessoa Engenheira de Dados");
    expect(titles[titles.length - 1]).toBe("Pessoa Desenvolvedora Front-end");
  });

  it("abre o detalhe da vaga a partir do catálogo", async () => {
    await renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Ver vaga Pessoa Desenvolvedora Front-end" }));
    expect(await screen.findByRole("button", { name: /Voltar para vagas/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Candidatar-se com 1 clique/i })).toBeInTheDocument();
  });

  it("abre o Login a partir de Entrar", async () => {
    await renderHome();
    fireEvent.click(screen.getByRole("link", { name: "Entrar" }));
    expect(screen.getByRole("heading", { name: "Entre na sua conta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar com Google/i })).toBeInTheDocument();
  });

  it("renderiza o detalhe diretamente em /jobs/:id", async () => {
    await renderAt("/jobs/1");
    expect(await screen.findByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Candidatar-se com 1 clique/i })).toBeInTheDocument();
  });

  it("renderiza o Login diretamente em /login", async () => {
    await renderAt("/login");
    expect(screen.getByRole("heading", { name: "Entre na sua conta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar com Google/i })).toBeInTheDocument();
  });

  it("abre o menu mobile com os destinos existentes", async () => {
    await renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    const mobile = document.getElementById("mobile-navigation");
    expect(mobile).toBeTruthy();
    expect(within(mobile).getByRole("link", { name: "Vagas" })).toBeInTheDocument();
    expect(within(mobile).getByRole("link", { name: "Para empresas" })).toBeInTheDocument();
    expect(within(mobile).getByRole("link", { name: "Comunidade" })).toBeInTheDocument();
    expect(within(mobile).getByRole("link", { name: "Entrar" })).toBeInTheDocument();
  });

  it("alterna o tema no Header sem quebrar a navegação", async () => {
    await renderHome();
    expect(screen.getByRole("link", { name: "Ir para a página inicial" })).toBeInTheDocument();
    const dark = screen.getByRole("button", { name: "Escuro" });
    fireEvent.click(dark);
    expect(dark).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    fireEvent.click(screen.getByRole("link", { name: "Entrar" }));
    expect(screen.getByRole("heading", { name: "Entre na sua conta" })).toBeInTheDocument();
  });

  it("mostra sessão no Header quando o adaptador devolve usuário", async () => {
    authState.session = { user: { id: "u1", email: "ana@example.invalid" } };
    authState.profile = {
      full_name: "Ana Demo",
      role: "candidate",
      skills: ["React"],
      preferences: { experience_level: "mid", work_model: "remote", location: "Brasil" },
    };
    authState.needsOnboarding = false;
    await renderHome();
    expect(screen.getByRole("button", { name: "Ana Demo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sair/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Minhas candidaturas" })).toHaveAttribute("href", "/minhas-candidaturas");
  });

  it("renderiza o dashboard em /minhas-candidaturas com sessão", async () => {
    authState.session = { user: { id: "u1", email: "ana@example.invalid" } };
    authState.profile = { full_name: "Ana Demo", role: "candidate" };
    authState.needsOnboarding = false;
    await renderAt("/minhas-candidaturas");
    expect(await screen.findByRole("heading", { name: "Minhas candidaturas" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Você ainda não se candidatou" })).toBeInTheDocument();
  });

  it("não mostra CTA azul antes do estado aplicado quando já candidatado", async () => {
    authState.session = { user: { id: "u1", email: "ana@example.invalid" } };
    authState.profile = {
      full_name: "Ana Demo",
      role: "candidate",
      skills: ["React"],
      preferences: { experience_level: "mid", work_model: "remote", location: "Brasil" },
    };
    authState.needsOnboarding = false;
    let resolveApplication;
    loadMyApplicationMock.mockImplementation(
      () => new Promise((resolve) => { resolveApplication = resolve; }),
    );
    await renderAt("/jobs/1");
    expect(await screen.findByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Candidatar-se com 1 clique/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verificando candidatura/i })).toBeInTheDocument();
    resolveApplication({ status: "submitted" });
    expect(await screen.findByText("Candidatura enviada!")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Candidatar-se com 1 clique/i })).not.toBeInTheDocument();
  });
});
