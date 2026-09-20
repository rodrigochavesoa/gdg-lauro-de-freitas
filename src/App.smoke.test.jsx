import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const authState = {
  session: null,
  profile: null,
  needsOnboarding: false,
};

let authListener = null;
const avatarPublicUrlMock = vi.hoisted(() => vi.fn(async () => null));
const saveProfileAvatarMock = vi.hoisted(() => vi.fn());
const saveOnboardingProfileMock = vi.hoisted(() => vi.fn());
const avatarUploadEnabled = vi.hoisted(() => ({ value: false }));

vi.mock("./features/auth/auth-api.js", async () => {
  const actual = await vi.importActual("./features/auth/auth-api.js");
  return {
    ...actual,
    loadAuthSnapshot: async () => authState,
    subscribeAuth: (onChange) => {
      authListener = onChange;
      onChange(authState);
      return () => {
        if (authListener === onChange) authListener = null;
      };
    },
    avatarPublicUrl: (...args) => avatarPublicUrlMock(...args),
    saveProfileAvatar: (...args) => saveProfileAvatarMock(...args),
    saveOnboardingProfile: (...args) => saveOnboardingProfileMock(...args),
    isAvatarUploadEnabled: () => avatarUploadEnabled.value,
    signOutUser: vi.fn(async () => {
      authState.session = null;
      authState.profile = null;
      authState.needsOnboarding = false;
    }),
    startGoogleOAuth: vi.fn(),
  };
});

vi.mock("./features/curation/curation-api.js", () => ({
  loadCurationProfile: async () => null,
  signInCuration: vi.fn(),
}));

vi.mock("./features/curation/CurationQueue.jsx", () => ({
  CurationQueue: () => <div data-testid="curation-queue" />,
}));

vi.mock("./features/auth/staff-mfa.js", async () => {
  const actual = await vi.importActual("./features/auth/staff-mfa.js");
  return {
    ...actual,
    isStaffMfaRequired: () => false,
  };
});

vi.mock("./features/admin/admin-jobs-api.js", async () => {
  const actual = await vi.importActual("./features/admin/admin-jobs-api.js");
  return {
    ...actual,
    loadAdminJobPage: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 24, hasNext: false })),
  };
});

const loadMyApplicationMock = vi.fn(async () => null);
const loadMyApplicationsMock = vi.fn(async () => []);
const loadPrivacyPreferencesMock = vi.fn(async () => ({ purposes: [], events: [], source: "fallback" }));

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

vi.mock("./features/privacy/privacy-api.js", async () => {
  const actual = await vi.importActual("./features/privacy/privacy-api.js");
  return {
    ...actual,
    loadPrivacyPreferences: (...args) => loadPrivacyPreferencesMock(...args),
  };
});

vi.mock("./features/ingest/ingest-api.js", async () => {
  const actual = await vi.importActual("./features/ingest/ingest-api.js");
  return {
    ...actual,
    loadJobIngestions: vi.fn(async () => []),
    processJobIngestion: vi.fn(),
  };
});

vi.mock("./features/catalog/jobs-api.js", () => {
  const catalogJobs = [
    {
      id: "1",
      title: "Pessoa Desenvolvedora Front-end",
      company: "Nuvem Lauro Demo",
      logo: "NL",
      color: "#1e40af",
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
      color: "#991b1b",
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
      color: "#92400e",
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
      color: "#166534",
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

  function filterCatalog(opts = {}) {
    const query = String(opts.query ?? "").toLowerCase();
    let rows = [...catalogJobs];
    if (query) {
      rows = rows.filter((job) =>
        `${job.title} ${job.company} ${job.stack.join(" ")}`.toLowerCase().includes(query),
      );
    }
    const tech = opts.tech ?? [];
    if (tech.length) {
      rows = rows.filter((job) =>
        tech.some((item) => job.stack.join(" ").toLowerCase().includes(item.toLowerCase())),
      );
    }
    const level = opts.level ?? [];
    if (level.length) {
      rows = rows.filter((job) => level.includes(job.level));
    }
    const workModel = opts.workModel ?? [];
    if (workModel.length) {
      rows = rows.filter((job) => workModel.includes(job.type));
    }
    rows.sort((left, right) => {
      const delta = Date.parse(right.postedAt) - Date.parse(left.postedAt);
      return opts.sort === "oldest" ? -delta : delta;
    });
    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? 24;
    return { jobs: rows.slice(offset, offset + limit), count: rows.length };
  }

  return {
    findApprovedJobInCache: (id) => catalogJobs.find((job) => String(job.id) === String(id)) ?? null,
    peekApprovedJobsCache: () => catalogJobs,
    peekApprovedJobsPage: (params) => {
      const query = params?.query ?? "";
      const tech = params?.tech ?? [];
      const level = params?.level ?? [];
      const workModel = params?.workModel ?? [];
      if (query || tech.length || level.length || workModel.length || params?.sort === "oldest") {
        return filterCatalog(params);
      }
      return { jobs: catalogJobs, count: catalogJobs.length };
    },
    loadApprovedJobs: async (opts = {}) => filterCatalog(opts),
    loadApprovedJob: async (id) => ({
      id,
      title: "Pessoa Desenvolvedora Front-end",
      company: "Nuvem Lauro Demo",
      logo: "NL",
      color: "#1e40af",
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
    CATALOG_PAGE_SIZE: 24,
  };
});

import { App } from "./App.jsx";
import * as avatarCrop from "./features/auth/avatar-crop.js";
import { signOutUser } from "./features/auth/auth-api.js";
import { THEME_STORAGE_KEY } from "./shared/ui/theme.js";

function placeholderLabels(root = document) {
  return [...root.querySelectorAll(".nav-link-placeholder")].map((el) => el.textContent);
}

beforeEach(() => {
  authState.session = null;
  authState.profile = null;
  authState.needsOnboarding = false;
  authListener = null;
  avatarPublicUrlMock.mockReset();
  avatarPublicUrlMock.mockResolvedValue(null);
  saveProfileAvatarMock.mockReset();
  saveOnboardingProfileMock.mockReset();
  avatarUploadEnabled.value = false;
  signOutUser.mockReset();
  signOutUser.mockImplementation(async () => {
    authState.session = null;
    authState.profile = null;
    authState.needsOnboarding = false;
  });
  localStorage.removeItem(THEME_STORAGE_KEY);
  document.documentElement.setAttribute("data-theme", "system");
  loadMyApplicationMock.mockReset();
  loadMyApplicationMock.mockResolvedValue(null);
  loadMyApplicationsMock.mockReset();
  loadMyApplicationsMock.mockResolvedValue([]);
  loadPrivacyPreferencesMock.mockReset();
  loadPrivacyPreferencesMock.mockResolvedValue({ purposes: [], events: [], source: "fallback" });
});

async function renderAt(path = "/") {
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

async function renderHome() {
  await renderAt("/vagas");
  await waitFor(() => {
    expect(screen.getByText("4 oportunidades encontradas")).toBeInTheDocument();
  });
}

function fillOnboarding({
  name = "Ada Lovelace",
  level = "junior",
  model = "remote",
  skills = "React",
  location = "Salvador",
} = {}) {
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Nível"), { target: { value: level } });
  fireEvent.change(screen.getByLabelText("Modalidade"), { target: { value: model } });
  fireEvent.change(screen.getByLabelText("Tecnologias (separe por vírgula)"), { target: { value: skills } });
  fireEvent.change(screen.getByLabelText("Localidade"), { target: { value: location } });
}
describe("ARQ-01 — caracterização do shell", () => {
  it("renderiza o portal como primeira tela e encaminha a busca para vagas", async () => {
    await renderAt("/");
    expect(screen.getByRole("heading", { name: /Seu futuro em tech tem endereço/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Vagas em destaque" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Criar perfil gratuito/i })).toHaveAttribute("href", "/login");
    fireEvent.change(screen.getByRole("search", { name: "Buscar vagas" }).querySelector("input"), { target: { value: "React" } });
    fireEvent.submit(screen.getByRole("search", { name: "Buscar vagas" }));
    expect(await screen.findByRole("heading", { name: "Vagas em destaque" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Cargo, tecnologia ou empresa")).toHaveValue("React");
  });

  it("renderiza ações contextuais na home para candidato logado", async () => {
    authState.session = { user: { id: "u1", email: "ana@example.invalid" } };
    authState.profile = {
      full_name: "Ana Demo",
      role: "candidate",
      skills: ["React"],
      preferences: { experience_level: "mid", work_model: "remote", location: "Brasil" },
    };
    authState.needsOnboarding = false;

    await renderAt("/");

    expect(await screen.findByRole("heading", { name: "Seu perfil já está pronto para novas oportunidades." })).toBeInTheDocument();
    const memberCta = document.querySelector(".portal-member-cta");
    expect(within(memberCta).getByRole("link", { name: "Explorar vagas" })).toHaveAttribute("href", "/vagas");
    expect(within(memberCta).getByRole("link", { name: "Minhas candidaturas" })).toHaveAttribute("href", "/minhas-candidaturas");
    expect(screen.queryByRole("link", { name: "Criar perfil gratuito" })).not.toBeInTheDocument();
  });

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
    await waitFor(() => {
      const titles = [...document.querySelectorAll("a.job-card")].map((card) => within(card).getByRole("heading").textContent);
      expect(titles[0]).toBe("Pessoa Engenheira de Dados");
      expect(titles[titles.length - 1]).toBe("Pessoa Desenvolvedora Front-end");
    });
  });

  it("navega para Eventos pelo menu principal", async () => {
    await renderHome();
    fireEvent.click(screen.getAllByRole("link", { name: "Eventos" })[0]);
    expect(await screen.findByRole("heading", { level: 1, name: "Eventos" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Ver evento" })).toHaveLength(2);
    expect(document.querySelector(".hero")).toBeTruthy();
    expect(document.querySelector(".home-divider__curve")).toBeTruthy();
    expect(document.querySelector(".home-divider__avatar")).toHaveAttribute(
      "src",
      "/avatar-eventos-lgbtqia.png",
    );
    expect(document.querySelector(".event-banner")).toBeNull();
  });

  it("rola ao topo ao abrir a landing a partir do índice de eventos", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    await renderAt("/eventos");
    expect(await screen.findByRole("heading", { level: 1, name: "Eventos" })).toBeInTheDocument();
    scrollTo.mockClear();
    fireEvent.click(screen.getAllByRole("link", { name: "Ver evento" })[0]);
    expect(await screen.findByRole("button", { name: /Voltar para eventos/i })).toBeInTheDocument();
    expect(document.querySelector(".event-banner")).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    scrollTo.mockRestore();
  });

  it("renderiza o índice em /eventos sem login", async () => {
    await renderAt("/eventos");
    expect(await screen.findByRole("heading", { level: 1, name: "Eventos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Devfest Lauro de Freitas 2026/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /DevOpsDays Salvador 2026/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Entre na sua conta" })).not.toBeInTheDocument();
    expect(document.querySelector(".hero")).toBeTruthy();
    expect(document.querySelector(".home-divider__curve")).toBeTruthy();
    expect(document.querySelector(".home-divider__avatar")).toHaveAttribute(
      "src",
      "/avatar-eventos-lgbtqia.png",
    );
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
    fireEvent.click(screen.getByRole("link", { name: /Pessoa Desenvolvedora Front-end/ }));
    expect(await screen.findByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Voltar para vagas/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Candidatar-se com 1 clique/i })).toBeInTheDocument();
    expect(loadMyApplicationMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Voltar para vagas/i }));
    expect(await screen.findByRole("heading", { name: "Vagas em destaque" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Seu futuro em tech tem endereço/i })).not.toBeInTheDocument();
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

  it("visitante em /jobs/:id vê CTA e não chama loadMyApplication", async () => {
    await renderAt("/jobs/1");
    expect(await screen.findByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Candidatar-se com 1 clique/i })).toBeInTheDocument();
    expect(loadMyApplicationMock).not.toHaveBeenCalled();
  });

  it("renderiza o detalhe diretamente em /jobs/:id", async () => {
    await renderAt("/jobs/1");
    expect(await screen.findByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Candidatar-se com 1 clique/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Voltar para vagas/i })).toBeInTheDocument();
    expect(loadMyApplicationMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Voltar para vagas/i }));
    expect(await screen.findByRole("heading", { name: "Vagas em destaque" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Seu futuro em tech tem endereço/i })).not.toBeInTheDocument();
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
    expect(screen.getByText(/Use o e-mail e a senha da sua conta de equipe GDG Jobs/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("seu-email@empresa.com")).toBeInTheDocument();
    expect(screen.queryByText(/conta de teste/i)).not.toBeInTheDocument();
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

  it("expõe skip link e landmark main nas rotas do MVP-019", async () => {
    const routes = ["/", "/vagas", "/jobs/1", "/login", "/admin", "/admin/curadoria", "/perfil"];
    for (const path of routes) {
      const { unmount } = render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
      expect(screen.getByRole("link", { name: "Ir para o conteúdo" })).toHaveAttribute("href", "#conteudo");
      const main = document.querySelector("main#conteudo");
      expect(main).toBeTruthy();
      unmount();
    }
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

  it("staff em /admin vê o painel, ingestão e o catálogo público permanece só approved", async () => {
    authState.session = { user: { id: "a1", email: "ada@example.invalid" } };
    authState.profile = { full_name: "Ada Admin", role: "admin" };
    authState.needsOnboarding = false;
    await renderAt("/admin");
    expect(await screen.findByRole("heading", { name: "Painel" })).toBeInTheDocument();
    const tabs = document.querySelector(".admin-tabs");
    expect(within(tabs).getByRole("link", { name: "Vagas" })).toHaveAttribute("href", "/admin/vagas");
    fireEvent.click(within(tabs).getByRole("link", { name: "Ingestão" }));
    expect(await screen.findByRole("heading", { name: "Ingestão" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ingerir fixture (pendente)" })).toBeInTheDocument();
    fireEvent.click(within(tabs).getByRole("link", { name: "Vagas" }));
    expect(await screen.findByRole("heading", { name: "Gestão de vagas" })).toBeInTheDocument();
  });

  it("staff abre /admin/curadoria por deep link e candidato permanece fora", async () => {
    authState.session = { user: { id: "a1", email: "ada@example.invalid" } };
    authState.profile = { full_name: "Ada Admin", role: "admin" };
    authState.needsOnboarding = false;
    await renderAt("/admin/curadoria");
    expect(await screen.findByTestId("curation-queue")).toBeInTheDocument();

    cleanup();
    authState.session = { user: { id: "u1", email: "ana@example.invalid" } };
    authState.profile = { full_name: "Ana Demo", role: "candidate" };
    authState.needsOnboarding = false;
    await renderAt("/admin/vagas/nova");
    expect(await screen.findByRole("heading", { name: "Entrar para curadoria ou admin" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Publicar nova vaga" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("curation-queue")).not.toBeInTheDocument();
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

  it("staff em /jobs/:id não vê CTA nem dispara loadMyApplication", async () => {
    authState.session = { user: { id: "a1", email: "ada@example.invalid" } };
    authState.profile = { full_name: "Ada Admin", role: "admin" };
    authState.needsOnboarding = false;
    await renderAt("/jobs/1");
    expect(await screen.findByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.getByText(/Contas staff não se candidatam/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Candidatar-se com 1 clique/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Verificando candidatura/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retirar candidatura/i })).not.toBeInTheDocument();
    expect(loadMyApplicationMock).not.toHaveBeenCalled();
  });

  it("sessão logada sem role hidratada não flasha CTA de candidato", async () => {
    authState.session = { user: { id: "a1", email: "ada@example.invalid" } };
    authState.profile = null;
    authState.needsOnboarding = false;
    await renderAt("/jobs/1");
    expect(await screen.findByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Candidatar-se com 1 clique/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Verificando candidatura/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Contas staff não se candidatam/i)).not.toBeInTheDocument();
    expect(loadMyApplicationMock).not.toHaveBeenCalled();
  });

  it("renderiza o dashboard em /minhas-candidaturas com sessão", async () => {
    authState.session = { user: { id: "u1", email: "ana@example.invalid" } };
    authState.profile = { full_name: "Ana Demo", role: "candidate" };
    authState.needsOnboarding = false;
    await renderAt("/minhas-candidaturas");
    expect(await screen.findByRole("heading", { name: "Minhas candidaturas" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Você ainda não se candidatou" })).toBeInTheDocument();
    expect(screen.queryByText("Carregando…")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Carregando candidaturas" })).not.toBeInTheDocument();
  });

  it("carrega /perfil com valores salvos e e-mail somente leitura", async () => {
    authState.session = { user: { id: "u1", email: "vc@example.invalid" } };
    authState.profile = {
      full_name: "Vinicius Costa",
      role: "candidate",
      skills: ["React"],
      bio: "Bio salva",
      preferences: { experience_level: "mid", work_model: "remote", location: "Salvador" },
    };
    authState.needsOnboarding = false;
    await renderAt("/perfil");
    expect(await screen.findByRole("heading", { name: "Editar perfil" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("Vinicius Costa");
    expect(screen.getByLabelText("E-mail")).toHaveValue("vc@example.invalid");
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Nível")).toHaveValue("mid");
    expect(screen.getByLabelText("Tecnologias (separe por vírgula)")).toHaveValue("React");
    expect(screen.getByLabelText("Localidade")).toHaveValue("Salvador");
    expect(screen.getByLabelText("Bio")).toHaveValue("Bio salva");
    expect(screen.queryByLabelText(/papel|função|cargo/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Vinicius Costa" }));
    expect(screen.getByRole("link", { name: "Editar perfil" })).toHaveAttribute("href", "/perfil");
  });

  it("salva o perfil e reabre /perfil com os dados persistidos", async () => {
    authState.session = { user: { id: "u1", email: "vc@example.invalid" } };
    authState.profile = {
      full_name: "Vinicius Costa",
      role: "candidate",
      skills: ["React"],
      preferences: { experience_level: "mid", work_model: "remote", location: "Salvador" },
    };
    authState.needsOnboarding = false;
    const persisted = {
      full_name: "Vinicius C.",
      role: "candidate",
      skills: ["Go"],
      preferences: { experience_level: "senior", work_model: "hybrid", location: "Lauro" },
    };
    saveOnboardingProfileMock.mockResolvedValue(persisted);
    await renderAt("/perfil");
    expect(await screen.findByRole("heading", { name: "Editar perfil" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Vinicius C." } });
    fireEvent.change(screen.getByLabelText("Nível"), { target: { value: "senior" } });
    fireEvent.change(screen.getByLabelText("Modalidade"), { target: { value: "hybrid" } });
    fireEvent.change(screen.getByLabelText("Tecnologias (separe por vírgula)"), { target: { value: "Go" } });
    fireEvent.change(screen.getByLabelText("Localidade"), { target: { value: "Lauro" } });
    fireEvent.submit(screen.getByRole("button", { name: "Salvar perfil" }).closest("form"));
    await waitFor(() => expect(saveOnboardingProfileMock).toHaveBeenCalled());
    expect(screen.getByRole("heading", { name: "Editar perfil" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("Vinicius C.");
    cleanup();
    authState.profile = persisted;
    await renderAt("/perfil");
    expect(await screen.findByRole("heading", { name: "Editar perfil" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("Vinicius C.");
    expect(screen.getByLabelText("Nível")).toHaveValue("senior");
    expect(screen.getByLabelText("Modalidade")).toHaveValue("hybrid");
    expect(screen.getByLabelText("Tecnologias (separe por vírgula)")).toHaveValue("Go");
    expect(screen.getByLabelText("Localidade")).toHaveValue("Lauro");
  });

  it("redireciona /perfil sem sessão para o login", async () => {
    await renderAt("/perfil");
    expect(await screen.findByRole("heading", { name: "Entre na sua conta" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Editar perfil" })).not.toBeInTheDocument();
  });

  it("URL direta de /perfil com perfil incompleto ainda cai no onboarding", async () => {
    authState.session = { user: { id: "u1", email: "ada@example.invalid" } };
    authState.profile = { full_name: "", role: "candidate" };
    authState.needsOnboarding = true;
    await renderAt("/perfil");
    expect(await screen.findByRole("heading", { name: /Complete seus dados para usar o GDGJobs/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Editar perfil" })).not.toBeInTheDocument();
  });

  it("staff em /perfil não vê o formulário de candidato", async () => {
    authState.session = { user: { id: "a1", email: "ada@example.invalid" } };
    authState.profile = { full_name: "Ada Admin", role: "admin" };
    authState.needsOnboarding = false;
    await renderAt("/perfil");
    expect(await screen.findByRole("heading", { name: "Continue fazendo a tecnologia acontecer." })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Editar perfil" })).not.toBeInTheDocument();
  });

  it("logout durante o salvamento de /perfil descarta a resposta atrasada", async () => {
    let resolveSave;
    saveOnboardingProfileMock.mockImplementation(
      () => new Promise((resolve) => { resolveSave = resolve; }),
    );
    authState.session = { user: { id: "u1", email: "ana@example.invalid" } };
    authState.profile = {
      full_name: "Ana Demo",
      role: "candidate",
      skills: ["React"],
      preferences: { experience_level: "mid", work_model: "remote", location: "Brasil" },
    };
    authState.needsOnboarding = false;
    await renderAt("/perfil");
    expect(await screen.findByRole("heading", { name: "Editar perfil" })).toBeInTheDocument();
    fireEvent.submit(screen.getByRole("button", { name: "Salvar perfil" }).closest("form"));
    await waitFor(() => expect(saveOnboardingProfileMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Sair/i }));
    expect(await screen.findByRole("heading", { name: "Entre na sua conta" })).toBeInTheDocument();

    resolveSave({
      full_name: "Ana Stale",
      role: "candidate",
      skills: ["React"],
      preferences: { experience_level: "mid", work_model: "remote", location: "Brasil" },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.queryByRole("button", { name: "Ana Stale" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ana Demo" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Entre na sua conta" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Editar perfil" })).not.toBeInTheDocument();
  });

  it("troca de usuário durante o salvamento de /perfil descarta a resposta atrasada", async () => {
    let resolveSave;
    saveOnboardingProfileMock.mockImplementation(
      () => new Promise((resolve) => { resolveSave = resolve; }),
    );
    authState.session = { user: { id: "u1", email: "ana@example.invalid" } };
    authState.profile = {
      full_name: "Ana Demo",
      role: "candidate",
      skills: ["React"],
      preferences: { experience_level: "mid", work_model: "remote", location: "Brasil" },
    };
    authState.needsOnboarding = false;
    await renderAt("/perfil");
    expect(await screen.findByRole("heading", { name: "Editar perfil" })).toBeInTheDocument();
    fireEvent.submit(screen.getByRole("button", { name: "Salvar perfil" }).closest("form"));
    await waitFor(() => expect(saveOnboardingProfileMock).toHaveBeenCalled());

    authListener({
      session: { user: { id: "u2", email: "vc@example.invalid" } },
      profile: {
        full_name: "Vinicius Costa",
        role: "candidate",
        skills: ["Go"],
        preferences: { experience_level: "junior", work_model: "hybrid", location: "Salvador" },
      },
      needsOnboarding: false,
    });
    expect(await screen.findByRole("button", { name: "Vinicius Costa" })).toBeInTheDocument();

    resolveSave({
      full_name: "Ana Stale",
      role: "admin",
      skills: ["Hacked"],
      preferences: { experience_level: "senior", work_model: "remote", location: "X" },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.getByRole("button", { name: "Vinicius Costa" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ana Stale" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ana Demo" })).not.toBeInTheDocument();
  });

  it("resposta atrasada do usuário anterior não substitui o perfil atual", async () => {
    let resolveSave;
    saveOnboardingProfileMock.mockImplementation(
      () => new Promise((resolve) => { resolveSave = resolve; }),
    );
    authState.session = { user: { id: "u1", email: "ana@example.invalid" } };
    authState.profile = {
      full_name: "Ana Demo",
      role: "candidate",
      skills: ["React"],
      preferences: { experience_level: "mid", work_model: "remote", location: "Brasil" },
    };
    authState.needsOnboarding = false;
    await renderAt("/perfil");
    expect(await screen.findByRole("heading", { name: "Editar perfil" })).toBeInTheDocument();
    fireEvent.submit(screen.getByRole("button", { name: "Salvar perfil" }).closest("form"));
    await waitFor(() => expect(saveOnboardingProfileMock).toHaveBeenCalled());

    authListener({
      session: { user: { id: "u2", email: "vc@example.invalid" } },
      profile: {
        full_name: "Vinicius Costa",
        role: "candidate",
        skills: ["Go"],
        preferences: { experience_level: "junior", work_model: "hybrid", location: "Salvador" },
      },
      needsOnboarding: false,
    });
    expect(await screen.findByRole("button", { name: "Vinicius Costa" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Minhas candidaturas" })).toBeInTheDocument();

    resolveSave({
      full_name: "Ana Stale",
      role: "admin",
      skills: ["Hacked"],
      preferences: { experience_level: "senior", work_model: "remote", location: "X" },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.getByRole("button", { name: "Vinicius Costa" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Área admin" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Minhas candidaturas" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ana Stale" })).not.toBeInTheDocument();
  });

  it("volta de /jobs/:id para minhas candidaturas quando a origem é o dashboard", async () => {
    authState.session = { user: { id: "u1", email: "ana@example.invalid" } };
    authState.profile = { full_name: "Ana Demo", role: "candidate" };
    authState.needsOnboarding = false;
    loadMyApplicationsMock.mockResolvedValue([
      {
        id: "a1",
        jobId: "1",
        status: "submitted",
        jobTitle: "Pessoa Desenvolvedora Front-end",
        companyName: "Nuvem Lauro Demo",
        updatedAt: "2026-09-07T00:00:00.000Z",
      },
    ]);
    await renderAt("/minhas-candidaturas");
    expect(await screen.findByRole("link", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Pessoa Desenvolvedora Front-end" }));
    expect(await screen.findByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar para minhas candidaturas" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Voltar para vagas/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar para minhas candidaturas" }));
    expect(await screen.findByRole("heading", { name: "Minhas candidaturas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Seu futuro em tech tem endereço/i })).not.toBeInTheDocument();
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

  it("com perfil incompleto permanece em /onboarding ao clicar Vagas", async () => {
    authState.session = { user: { id: "u1", email: "ada@example.invalid" } };
    authState.profile = { full_name: "", role: "candidate" };
    authState.needsOnboarding = true;
    await renderAt("/onboarding");
    expect(screen.getByRole("heading", { name: /Complete seus dados para usar o GDGJobs/i })).toBeInTheDocument();
    const desktopNav = document.querySelector(".topbar nav");
    fireEvent.click(within(desktopNav).getByRole("link", { name: "Vagas" }));
    fireEvent.click(within(desktopNav).getByRole("link", { name: "Newsletter" }));
    expect(screen.getByRole("heading", { name: /Complete seus dados para usar o GDGJobs/i })).toBeInTheDocument();
    expect(screen.queryByText("4 oportunidades encontradas")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Complete o perfil");
    expect(screen.getByRole("link", { name: "Continuar" })).toHaveAttribute("href", "/onboarding");
  });

  it("URL direta de /vagas com perfil incompleto ainda cai no onboarding", async () => {
    authState.session = { user: { id: "u1", email: "ada@example.invalid" } };
    authState.profile = { full_name: "", role: "candidate" };
    authState.needsOnboarding = true;
    await renderAt("/vagas");
    expect(await screen.findByRole("heading", { name: /Complete seus dados para usar o GDGJobs/i })).toBeInTheDocument();
  });

  it("não aquece preferências de privacidade durante o onboarding", async () => {
    authState.session = { user: { id: "u1", email: "ada@example.invalid" } };
    authState.profile = { full_name: "", role: "candidate" };
    authState.needsOnboarding = true;
    await renderAt("/onboarding");
    expect(await screen.findByRole("heading", { name: /Complete seus dados para usar o GDGJobs/i })).toBeInTheDocument();
    await waitFor(() => expect(loadMyApplicationsMock).toHaveBeenCalled());
    expect(loadPrivacyPreferencesMock).not.toHaveBeenCalled();
  });

  it("onboarding válido salva e redireciona para a home", async () => {
    const saved = {
      full_name: "Ada Lovelace",
      role: "candidate",
      skills: ["React"],
      preferences: { experience_level: "junior", work_model: "remote", location: "Salvador" },
    };
    saveOnboardingProfileMock.mockResolvedValue(saved);
    authState.session = { user: { id: "u1", email: "ada@example.invalid" } };
    authState.profile = { full_name: "", role: "candidate" };
    authState.needsOnboarding = true;
    await renderAt("/onboarding");
    expect(await screen.findByRole("heading", { name: /Complete seus dados para usar o GDGJobs/i })).toBeInTheDocument();
    fillOnboarding();
    fireEvent.submit(screen.getByRole("button", { name: "Salvar perfil" }).closest("form"));
    await waitFor(() => expect(saveOnboardingProfileMock).toHaveBeenCalled());
    expect(await screen.findByRole("heading", { name: "Seu perfil já está pronto para novas oportunidades." })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Complete seus dados para usar o GDGJobs/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ada Lovelace" })).toBeInTheDocument();
  });

  it("logout durante o onboarding não redireciona a resposta atrasada", async () => {
    let resolveSave;
    saveOnboardingProfileMock.mockImplementation(
      () => new Promise((resolve) => { resolveSave = resolve; }),
    );
    authState.session = { user: { id: "u1", email: "ada@example.invalid" } };
    authState.profile = { full_name: "", role: "candidate" };
    authState.needsOnboarding = true;
    await renderAt("/onboarding");
    expect(await screen.findByRole("heading", { name: /Complete seus dados para usar o GDGJobs/i })).toBeInTheDocument();
    fillOnboarding();
    fireEvent.submit(screen.getByRole("button", { name: "Salvar perfil" }).closest("form"));
    await waitFor(() => expect(saveOnboardingProfileMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Sair/i }));
    expect(await screen.findByRole("link", { name: "Entrar ou criar conta" })).toBeInTheDocument();

    resolveSave({
      full_name: "Ada Stale",
      role: "candidate",
      skills: ["React"],
      preferences: { experience_level: "junior", work_model: "remote", location: "Salvador" },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.getByRole("link", { name: "Entrar ou criar conta" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ada Stale" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Seu perfil já está pronto para novas oportunidades." })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Complete seus dados para usar o GDGJobs/i })).not.toBeInTheDocument();
  });

  it("troca de usuário durante o onboarding descarta a resposta atrasada", async () => {
    let resolveSave;
    saveOnboardingProfileMock.mockImplementation(
      () => new Promise((resolve) => { resolveSave = resolve; }),
    );
    authState.session = { user: { id: "u1", email: "ada@example.invalid" } };
    authState.profile = { full_name: "", role: "candidate" };
    authState.needsOnboarding = true;
    await renderAt("/onboarding");
    expect(await screen.findByRole("heading", { name: /Complete seus dados para usar o GDGJobs/i })).toBeInTheDocument();
    fillOnboarding();
    fireEvent.submit(screen.getByRole("button", { name: "Salvar perfil" }).closest("form"));
    await waitFor(() => expect(saveOnboardingProfileMock).toHaveBeenCalled());

    authListener({
      session: { user: { id: "u2", email: "vc@example.invalid" } },
      profile: { full_name: "", role: "candidate" },
      needsOnboarding: true,
    });
    expect(await screen.findByRole("heading", { name: /Complete seus dados para usar o GDGJobs/i })).toBeInTheDocument();

    resolveSave({
      full_name: "Ada Stale",
      role: "admin",
      skills: ["Hacked"],
      preferences: { experience_level: "senior", work_model: "remote", location: "X" },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.getByRole("heading", { name: /Complete seus dados para usar o GDGJobs/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Seu perfil já está pronto para novas oportunidades." })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ada Stale" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Área admin" })).not.toBeInTheDocument();
  });

  it("aquece preferências de privacidade quando o perfil já está completo", async () => {
    authState.session = { user: { id: "u1", email: "ada@example.invalid" } };
    authState.profile = {
      full_name: "Ada Lovelace",
      role: "candidate",
      skills: ["React"],
      preferences: { experience_level: "mid", work_model: "remote", location: "Brasil" },
    };
    authState.needsOnboarding = false;
    await renderAt("/");
    await waitFor(() => expect(loadPrivacyPreferencesMock).toHaveBeenCalledWith({ userId: "u1" }));
  });

  it("sincroniza o Header no login sem flash de CTA e hidrata links de candidato depois", async () => {
    await renderAt("/");
    expect(screen.getByRole("link", { name: "Entrar ou criar conta" })).toBeInTheDocument();

    await waitFor(() => expect(authListener).toEqual(expect.any(Function)));
    authListener({
      session: { user: { id: "u1", email: "ana@example.invalid", user_metadata: { full_name: "Ana Demo" } } },
      profile: null,
      needsOnboarding: false,
    });

    expect(await screen.findByRole("button", { name: /Sair/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conta" })).toBeInTheDocument();
    expect(document.querySelector(".avatar--pending")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ana Demo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Entrar ou criar conta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Minhas candidaturas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Criar perfil gratuito" })).not.toBeInTheDocument();
    expect(placeholderLabels()).toEqual(["Minhas candidaturas"]);
    expect(screen.getByRole("heading", { name: "Deixe seu perfil trabalhar por você." })).toBeInTheDocument();

    authListener({
      session: { user: { id: "u1", email: "ana@example.invalid", user_metadata: { full_name: "Ana Demo" } } },
      profile: {
        full_name: "Ana Demo",
        role: "candidate",
        skills: ["React"],
        preferences: { experience_level: "mid", work_model: "remote", location: "Brasil" },
      },
      needsOnboarding: false,
    });

    expect(await screen.findByRole("heading", { name: "Seu perfil já está pronto para novas oportunidades." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ana Demo" })).toBeInTheDocument();
    expect(document.querySelector(".avatar--pending")).toBeNull();
    const desktopNav = document.querySelector(".topbar nav");
    expect(placeholderLabels(desktopNav)).toEqual([]);
    expect(within(desktopNav).getByRole("link", { name: "Minhas candidaturas" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Entrar ou criar conta" })).not.toBeInTheDocument();
  });

  it("limpa o Header no logout de forma otimista sem flash de avatar", async () => {
    authState.session = { user: { id: "u1", email: "ana@example.invalid" } };
    authState.profile = {
      full_name: "Ana Demo",
      role: "candidate",
      skills: ["React"],
      preferences: { experience_level: "mid", work_model: "remote", location: "Brasil" },
    };
    authState.needsOnboarding = false;
    signOutUser.mockImplementation(() => new Promise(() => {}));

    await renderAt("/");
    expect(await screen.findByRole("button", { name: /Sair/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ana Demo" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Sair/i }));

    expect(screen.queryByRole("button", { name: /Sair/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ana Demo" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar ou criar conta" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Criar perfil gratuito/i })).toBeInTheDocument();
    expect(placeholderLabels()).toEqual([]);
    expect(signOutUser).toHaveBeenCalledTimes(1);
  });

  it("mostra foto só depois da signed URL e iniciais se a URL falhar", async () => {
    let resolveUrl;
    avatarPublicUrlMock.mockImplementation(
      () => new Promise((resolve) => { resolveUrl = resolve; }),
    );
    authState.session = { user: { id: "u1", email: "ana@example.invalid", user_metadata: { full_name: "Rodrigo Chaves" } } };
    authState.profile = { full_name: "Vinicius Costa", role: "candidate", avatar_path: "u1/avatar.jpg" };
    authState.needsOnboarding = false;
    await renderHome();
    expect(screen.getByRole("button", { name: "Conta" })).toBeInTheDocument();
    expect(document.querySelector(".avatar--pending")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Rodrigo Chaves" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Vinicius Costa" })).not.toBeInTheDocument();

    resolveUrl("https://signed.example/u1");
    const trigger = await screen.findByRole("button", { name: "Vinicius Costa" });
    expect(trigger.querySelector("img")).toHaveAttribute("src", "https://signed.example/u1");
    expect(document.querySelector(".avatar--pending")).toBeNull();
  });

  it("TOKEN_REFRESHED do mesmo usuário não refaz signed URL nem volta ao skeleton", async () => {
    avatarPublicUrlMock.mockResolvedValue("https://signed.example/u1");
    authState.session = { user: { id: "u1", email: "ana@example.invalid" }, access_token: "t1" };
    authState.profile = { full_name: "Vinicius Costa", role: "candidate", avatar_path: "u1/avatar.jpg" };
    authState.needsOnboarding = false;
    await renderHome();
    const trigger = await screen.findByRole("button", { name: "Vinicius Costa" });
    expect(trigger.querySelector("img")).toHaveAttribute("src", "https://signed.example/u1");
    expect(avatarPublicUrlMock).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".avatar--pending")).toBeNull();

    for (let i = 0; i < 10; i += 1) {
      authListener({
        session: { user: { id: "u1", email: "ana@example.invalid" }, access_token: `t${i + 2}` },
        profile: { full_name: "Vinicius Costa", role: "candidate", avatar_path: "u1/avatar.jpg" },
        needsOnboarding: false,
      });
    }

    await waitFor(() => {
      expect(avatarPublicUrlMock).toHaveBeenCalledTimes(1);
    });
    expect(document.querySelector(".avatar--pending")).toBeNull();
    const afterRefresh = screen.getByRole("button", { name: "Vinicius Costa" });
    expect(afterRefresh.querySelector("img")).toHaveAttribute("src", "https://signed.example/u1");
    expect(document.querySelectorAll(".nav-actions img")).toHaveLength(1);
  });

  it("salvar nova foto resolve signed URL uma vez e mantém a foto visível", async () => {
    avatarUploadEnabled.value = true;
    avatarPublicUrlMock.mockResolvedValue("https://signed.example/u1");
    saveProfileAvatarMock.mockResolvedValue({
      full_name: "Vinicius Costa",
      role: "candidate",
      avatar_path: "u1/22222222-2222-4222-8222-222222222222.jpg",
    });
    const OriginalImage = globalThis.Image;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:https://preview.test/avatar");
    URL.revokeObjectURL = vi.fn();
    class FakeImage {
      constructor() {
        this.onload = null;
        this.onerror = null;
        this._src = "";
      }
      set src(value) {
        this._src = value;
        queueMicrotask(() => this.onload?.());
      }
      get src() {
        return this._src;
      }
    }
    globalThis.Image = FakeImage;
    const cropSpy = vi.spyOn(avatarCrop, "cropImageToCircle").mockResolvedValue(
      new Blob(["x"], { type: "image/jpeg" }),
    );
    authState.session = { user: { id: "u1", email: "ana@example.invalid" } };
    authState.profile = { full_name: "Vinicius Costa", role: "candidate", avatar_path: "u1/avatar.jpg" };
    authState.needsOnboarding = false;
    try {
      await renderHome();
      const trigger = await screen.findByRole("button", { name: "Vinicius Costa" });
      expect(trigger.querySelector("img")).toHaveAttribute("src", "https://signed.example/u1");
      expect(avatarPublicUrlMock).toHaveBeenCalledTimes(1);
      expect(document.querySelector(".avatar--pending")).toBeNull();

      avatarPublicUrlMock.mockResolvedValue("https://signed.example/u1b");
      fireEvent.change(screen.getByLabelText("Enviar foto de perfil"), {
        target: { files: [new File(["x"], "foto.jpg", { type: "image/jpeg" })] },
      });
      await screen.findByRole("dialog", { name: "Recortar foto" });
      fireEvent.click(screen.getByRole("button", { name: "Usar foto" }));

      await waitFor(() => expect(saveProfileAvatarMock).toHaveBeenCalled());
      await waitFor(() => {
        expect(document.querySelector(".avatar--pending")).toBeNull();
        expect(screen.getByRole("button", { name: "Vinicius Costa" }).querySelector("img")).toHaveAttribute(
          "src",
          "https://signed.example/u1b",
        );
      });
      expect(avatarPublicUrlMock).toHaveBeenCalledTimes(2);
    } finally {
      cropSpy.mockRestore();
      globalThis.Image = OriginalImage;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });

  it("URL de avatar nula cai nas iniciais do perfil confirmado", async () => {
    avatarPublicUrlMock.mockResolvedValue(null);
    authState.session = { user: { id: "u1", email: "ana@example.invalid", user_metadata: { full_name: "Rodrigo Chaves" } } };
    authState.profile = { full_name: "Vinicius Costa", role: "candidate", avatar_path: "u1/avatar.jpg" };
    authState.needsOnboarding = false;
    await renderHome();
    const trigger = await screen.findByRole("button", { name: "Vinicius Costa" });
    expect(trigger.querySelector("img")).toBeNull();
    expect(trigger).toHaveTextContent("VC");
    expect(screen.queryByRole("button", { name: "Rodrigo Chaves" })).not.toBeInTheDocument();
  });

  it("rejeição da signed URL cai nas iniciais do perfil confirmado", async () => {
    avatarPublicUrlMock.mockRejectedValue(new Error("network"));
    authState.session = { user: { id: "u1", email: "ana@example.invalid", user_metadata: { full_name: "Rodrigo Chaves" } } };
    authState.profile = { full_name: "Vinicius Costa", role: "candidate", avatar_path: "u1/avatar.jpg" };
    authState.needsOnboarding = false;
    await renderHome();
    const trigger = await screen.findByRole("button", { name: "Vinicius Costa" });
    expect(trigger.querySelector("img")).toBeNull();
    expect(trigger).toHaveTextContent("VC");
    expect(document.querySelector(".avatar--pending")).toBeNull();
    expect(screen.queryByRole("button", { name: "Rodrigo Chaves" })).not.toBeInTheDocument();
  });

  it("rejeição da signed URL ao salvar avatar sai do skeleton", async () => {
    avatarUploadEnabled.value = true;
    avatarPublicUrlMock.mockRejectedValue(new Error("network"));
    saveProfileAvatarMock.mockResolvedValue({
      full_name: "Vinicius Costa",
      role: "candidate",
      avatar_path: "u1/avatar.jpg",
    });
    const OriginalImage = globalThis.Image;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:https://preview.test/avatar");
    URL.revokeObjectURL = vi.fn();
    class FakeImage {
      constructor() {
        this.onload = null;
        this.onerror = null;
        this._src = "";
      }
      set src(value) {
        this._src = value;
        queueMicrotask(() => this.onload?.());
      }
      get src() {
        return this._src;
      }
    }
    globalThis.Image = FakeImage;
    const cropSpy = vi.spyOn(avatarCrop, "cropImageToCircle").mockResolvedValue(
      new Blob(["x"], { type: "image/jpeg" }),
    );
    authState.session = { user: { id: "u1", email: "ana@example.invalid" } };
    authState.profile = { full_name: "Vinicius Costa", role: "candidate" };
    authState.needsOnboarding = false;
    try {
      await renderHome();
      const trigger = await screen.findByRole("button", { name: "Vinicius Costa" });
      expect(trigger).toHaveTextContent("VC");
      expect(document.querySelector(".avatar--pending")).toBeNull();

      fireEvent.change(screen.getByLabelText("Enviar foto de perfil"), {
        target: { files: [new File(["x"], "foto.jpg", { type: "image/jpeg" })] },
      });
      await screen.findByRole("dialog", { name: "Recortar foto" });
      fireEvent.click(screen.getByRole("button", { name: "Usar foto" }));

      await waitFor(() => expect(saveProfileAvatarMock).toHaveBeenCalled());
      await waitFor(() => {
        expect(document.querySelector(".avatar--pending")).toBeNull();
        expect(screen.queryByRole("dialog", { name: "Recortar foto" })).not.toBeInTheDocument();
      });
      const afterSave = screen.getByRole("button", { name: "Vinicius Costa" });
      expect(afterSave.querySelector("img")).toBeNull();
      expect(afterSave).toHaveTextContent("VC");
    } finally {
      cropSpy.mockRestore();
      globalThis.Image = OriginalImage;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });

  it("não aplica signed URL obsoleta após logout", async () => {
    let resolveUrl;
    avatarPublicUrlMock.mockImplementation(
      () => new Promise((resolve) => { resolveUrl = resolve; }),
    );
    signOutUser.mockImplementation(() => new Promise(() => {}));
    authState.session = { user: { id: "u1", email: "ana@example.invalid" } };
    authState.profile = { full_name: "Ana Demo", role: "candidate", avatar_path: "u1/avatar.jpg" };
    authState.needsOnboarding = false;
    await renderHome();
    expect(screen.getByRole("button", { name: "Conta" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Sair/i }));
    expect(screen.queryByRole("button", { name: /Sair/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar ou criar conta" })).toBeInTheDocument();

    resolveUrl("https://signed.example/stale");
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("button", { name: "Ana Demo" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar ou criar conta" })).toBeInTheDocument();
  });

  it("troca de usuário não mantém a foto anterior", async () => {
    avatarPublicUrlMock.mockResolvedValue("https://signed.example/u1");
    authState.session = { user: { id: "u1", email: "ana@example.invalid" } };
    authState.profile = { full_name: "Ana Demo", role: "candidate", avatar_path: "u1/avatar.jpg" };
    authState.needsOnboarding = false;
    await renderHome();
    expect(await screen.findByRole("button", { name: "Ana Demo" })).toBeInTheDocument();
    expect(document.querySelector(".nav-actions img")).toHaveAttribute("src", "https://signed.example/u1");

    authListener({
      session: { user: { id: "u2", email: "vc@example.invalid", user_metadata: { full_name: "Rodrigo Chaves" } } },
      profile: { full_name: "Vinicius Costa", role: "candidate" },
      needsOnboarding: false,
    });

    const trigger = await screen.findByRole("button", { name: "Vinicius Costa" });
    expect(trigger.querySelector("img")).toBeNull();
    expect(trigger).toHaveTextContent("VC");
    expect(screen.queryByRole("button", { name: "Rodrigo Chaves" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ana Demo" })).not.toBeInTheDocument();
  });
});
