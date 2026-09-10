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

vi.mock("./features/curation/curation-api.js", () => ({
  loadCurationProfile: async () => null,
  signInCuration: vi.fn(),
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

vi.mock("./features/catalog/jobs-api.js", () => {
  const catalogJobs = [
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
  ];
  return {
    findApprovedJobInCache: (id) => catalogJobs.find((job) => String(job.id) === String(id)) ?? null,
    peekApprovedJobsCache: () => catalogJobs,
    loadApprovedJobs: async () => catalogJobs,
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
  };
});

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

  it("navega para Eventos pelo menu principal", async () => {
    await renderHome();
    fireEvent.click(screen.getAllByRole("link", { name: "Eventos" })[0]);
    expect(await screen.findByRole("heading", { level: 1, name: "Eventos" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Ver evento" })).toHaveLength(2);
    expect(document.querySelector(".hero")).toBeTruthy();
    expect(document.querySelector(".home-divider__curve")).toBeTruthy();
    expect(document.querySelector(".home-divider__avatar")).toBeNull();
    expect(document.querySelector(".event-banner")).toBeNull();
  });

  it("renderiza o índice em /eventos sem login", async () => {
    await renderAt("/eventos");
    expect(await screen.findByRole("heading", { level: 1, name: "Eventos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Devfest Lauro de Freitas 2026/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /DevOpsDays Salvador 2026/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Entre na sua conta" })).not.toBeInTheDocument();
    expect(document.querySelector(".hero")).toBeTruthy();
    expect(document.querySelector(".home-divider__curve")).toBeTruthy();
    expect(document.querySelector(".home-divider__avatar")).toBeNull();
    expect(document.querySelector(".cta")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Criar perfil gratuito/i })).toHaveAttribute("href", "/login");
  });

  it("abre o DevFest no slug e mantém o CTA Even3", async () => {
    await renderAt("/eventos/devfest-lauro-de-freitas-2026");
    expect(await screen.findByRole("heading", { name: /Devfest Lauro de Freitas 2026/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Realizar inscrição/i })).toHaveAttribute(
      "href",
      "https://www.even3.com.br/devfest-lauro-de-freitas-2026-779585/",
    );
    expect(document.querySelector(".event-banner")).toBeTruthy();
    expect(document.querySelector(".event-banner--portrait")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Voltar para eventos/i }));
    expect(await screen.findByRole("heading", { level: 1, name: "Eventos" })).toBeInTheDocument();
  });

  it("abre DevOpsDays no slug com banner vertical e CTA de tickets", async () => {
    await renderAt("/eventos/devopsdays-salvador-2026");
    expect(await screen.findByRole("heading", { name: /DevOpsDays Salvador 2026/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /DevOpsDays Salvador 2026/i })).toHaveClass("event-banner--portrait");
    expect(screen.getByRole("link", { name: /Garantir ingresso/i })).toHaveAttribute(
      "href",
      "https://tickets.devopsdays.org/devopsdays-salvador/2026/",
    );
    expect(screen.getByText("DevOpsDays Salvador")).toBeInTheDocument();
  });

  it("mantém /eventos acessível com sessão logada", async () => {
    authState.session = { user: { id: "u1", email: "ana@example.invalid" } };
    authState.profile = {
      full_name: "Ana Demo",
      role: "candidate",
      skills: ["React"],
      preferences: { experience_level: "mid", work_model: "remote", location: "Brasil" },
    };
    authState.needsOnboarding = false;
    await renderAt("/eventos");
    expect(await screen.findByRole("heading", { level: 1, name: "Eventos" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Entre na sua conta" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Minhas candidaturas" })).toBeInTheDocument();
    expect(document.querySelector(".cta")).toBeNull();
    expect(screen.queryByRole("link", { name: /Criar perfil gratuito/i })).not.toBeInTheDocument();
  });

  it("navega para Newsletter pelo menu principal", async () => {
    await renderHome();
    fireEvent.click(screen.getAllByRole("link", { name: "Newsletter" })[0]);
    expect(await screen.findByRole("heading", { level: 1, name: /GDG Jobs Letter/i })).toBeInTheDocument();
    expect(document.querySelector(".hero")).toBeTruthy();
    expect(document.querySelector(".home-divider__curve")).toBeTruthy();
    expect(document.querySelector(".home-divider__avatar")).toBeNull();
    expect(document.querySelector(".newsletter-layout")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Em breve/i })).toHaveAttribute("aria-disabled", "true");
  });

  it("renderiza Newsletter diretamente em /newsletter sem login", async () => {
    await renderAt("/newsletter");
    expect(await screen.findByRole("heading", { level: 1, name: /GDG Jobs Letter/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Inscrever-se" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Edições recentes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Criar perfil gratuito/i })).toHaveAttribute("href", "/login");
    expect(document.querySelector(".cta")).toBeTruthy();
    expect(document.querySelector(".home-divider__avatar")).toBeNull();
  });

  it("omite a faixa CTA da Newsletter quando há sessão", async () => {
    authState.session = { user: { id: "u1", email: "ana@example.invalid" } };
    authState.profile = {
      full_name: "Ana Demo",
      role: "candidate",
      skills: ["React"],
      preferences: { experience_level: "mid", work_model: "remote", location: "Brasil" },
    };
    authState.needsOnboarding = false;
    await renderAt("/newsletter");
    expect(await screen.findByRole("heading", { level: 1, name: /GDG Jobs Letter/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Criar perfil gratuito/i })).not.toBeInTheDocument();
    expect(document.querySelector(".cta")).toBeNull();
    expect(screen.getByRole("link", { name: "Minhas candidaturas" })).toBeInTheDocument();
  });

  it("abre o detalhe da vaga a partir do catálogo", async () => {
    await renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Ver vaga Pessoa Desenvolvedora Front-end" }));
    expect(await screen.findByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Voltar para vagas/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Candidatar-se com 1 clique/i })).toBeInTheDocument();
  });

  it("abre o Login a partir de Entrar ou criar conta", async () => {
    await renderHome();
    fireEvent.click(screen.getByRole("link", { name: "Entrar ou criar conta" }));
    expect(screen.getByRole("heading", { name: "Entre na sua conta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entrar ou criar conta com Google/i })).toBeInTheDocument();
  });

  it("abre o Login a partir de Criar perfil gratuito", async () => {
    await renderHome();
    fireEvent.click(screen.getByRole("link", { name: /Criar perfil gratuito/i }));
    expect(screen.getByRole("heading", { name: "Entre na sua conta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entrar ou criar conta com Google/i })).toBeInTheDocument();
  });

  it("renderiza o detalhe diretamente em /jobs/:id", async () => {
    await renderAt("/jobs/1");
    expect(await screen.findByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Candidatar-se com 1 clique/i })).toBeInTheDocument();
  });

  it("renderiza o Login diretamente em /login sem CTAs de auth no Header", async () => {
    await renderAt("/login");
    expect(screen.getByRole("heading", { name: "Entre na sua conta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entrar ou criar conta com Google/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Entrar ou criar conta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Entrar$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Criar conta$/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    const mobile = document.getElementById("mobile-navigation");
    expect(within(mobile).queryByRole("link", { name: "Entrar ou criar conta" })).not.toBeInTheDocument();
  });

  it("anon em /admin não mostra sidebar nem CTA de candidato no Header", async () => {
    await renderAt("/admin");
    expect(await screen.findByRole("heading", { name: "Entrar para curadoria ou admin" })).toBeInTheDocument();
    expect(
      screen.getByText(/Staff \(curador, moderador ou admin\) usa e-mail e senha da conta de teste abaixo/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Sprint 5/i)).not.toBeInTheDocument();
    expect(document.querySelector(".admin-side")).toBeNull();
    expect(document.querySelector("form.admin-auth-form")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Entrar ou criar conta" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Área admin" })).toHaveAttribute("href", "/admin");
  });

  it("abre o menu mobile com os destinos existentes", async () => {
    await renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    const mobile = document.getElementById("mobile-navigation");
    expect(mobile).toBeTruthy();
    expect(within(mobile).getByRole("link", { name: "Vagas" })).toBeInTheDocument();
    expect(within(mobile).getByRole("link", { name: "Eventos" })).toHaveAttribute("href", "/eventos");
    expect(within(mobile).getByRole("link", { name: "Newsletter" })).toHaveAttribute("href", "/newsletter");
    expect(within(mobile).getByRole("link", { name: "Área admin" })).toHaveAttribute("href", "/admin");
    expect(within(mobile).queryByRole("link", { name: "Para empresas" })).not.toBeInTheDocument();
    expect(within(mobile).queryByRole("link", { name: "Comunidade" })).not.toBeInTheDocument();
    expect(within(mobile).getByRole("link", { name: "Entrar ou criar conta" })).toBeInTheDocument();
  });

  it("alterna o tema no Header sem quebrar a navegação", async () => {
    await renderHome();
    expect(screen.getByRole("link", { name: "Ir para a página inicial" })).toBeInTheDocument();
    const dark = screen.getByRole("button", { name: "Escuro" });
    fireEvent.click(dark);
    expect(dark).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    fireEvent.click(screen.getByRole("link", { name: "Entrar ou criar conta" }));
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
    expect(screen.queryByRole("link", { name: "Área admin" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Para empresas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Comunidade" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Criar perfil gratuito/i })).not.toBeInTheDocument();
    expect(document.querySelector(".cta")).toBeNull();
  });

  it("staff logado vê Área admin e não vê Minhas candidaturas", async () => {
    authState.session = { user: { id: "a1", email: "ada@example.invalid" } };
    authState.profile = { full_name: "Ada Admin", role: "admin" };
    authState.needsOnboarding = false;
    await renderHome();
    expect(screen.getByRole("link", { name: "Área admin" })).toHaveAttribute("href", "/admin");
    expect(screen.queryByRole("link", { name: "Minhas candidaturas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Para empresas" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sair/i })).toBeInTheDocument();
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
