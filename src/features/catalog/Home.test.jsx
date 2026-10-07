import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useNavigate, useSearchParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { filterJobs } from "../../lib/filter-jobs.js";

const cachedJob = {
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
const privacyMocks = vi.hoisted(() => ({
  authorized: vi.fn(),
  subscribe: vi.fn(),
  listeners: [],
}));

vi.mock("./jobs-api.js", () => ({
  peekApprovedJobsPage: (...args) => peekApprovedJobsPage(...args),
  loadApprovedJobs: (...args) => loadApprovedJobs(...args),
  CATALOG_PAGE_SIZE: 24,
}));

vi.mock("../privacy/privacy-api.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isPrivacyPurposeAuthorizedForCurrentUser: (...args) => privacyMocks.authorized(...args),
    subscribePrivacyPreferencesInvalidation: (...args) => privacyMocks.subscribe(...args),
  };
});

import { Home } from "./Home.jsx";

function CatalogHistory({ to }) {
  const navigate = useNavigate();
  return (
    <div>
      <button type="button" onClick={() => navigate(to)}>Abrir busca</button>
      <button type="button" onClick={() => navigate(-1)}>Voltar</button>
    </div>
  );
}

function SearchParamsSnapshot() {
  const [params] = useSearchParams();
  return <output data-testid="search-params">{params.toString()}</output>;
}

const completeCandidate = {
  role: "candidate",
  full_name: "Ana Pessoa",
  skills: ["React"],
  preferences: { experience_level: "mid", work_model: "remote", location: "Lauro de Freitas" },
};

function pageFor(options = {}) {
  const filtered = filterJobs([cachedJob], options);
  return { jobs: filtered, count: filtered.length };
}

describe("Home", () => {
  beforeEach(() => {
    peekApprovedJobsPage.mockReset();
    loadApprovedJobs.mockReset();
    privacyMocks.authorized.mockReset();
    privacyMocks.subscribe.mockClear();
    privacyMocks.listeners.length = 0;
    privacyMocks.subscribe.mockImplementation((listener) => {
      privacyMocks.listeners.push(listener);
      return () => {
        privacyMocks.listeners = privacyMocks.listeners.filter((item) => item !== listener);
      };
    });
    privacyMocks.authorized.mockResolvedValue(false);
    peekApprovedJobsPage.mockImplementation((params) => {
      const query = params?.query ?? "";
      const tech = params?.tech ?? [];
      const level = params?.level ?? [];
      const workModel = params?.workModel ?? [];
      if (
        query ||
        tech.length ||
        level.length ||
        workModel.length ||
        params?.country ||
        params?.place ||
        params?.salaryMin != null ||
        params?.salaryMax != null ||
        params?.sort === "oldest"
      ) return null;
      return { jobs: [cachedJob], count: 1 };
    });
    loadApprovedJobs.mockImplementation(async (options = {}) => pageFor(options));
  });

  it("falha fechado em F-06 e não lê skills ou preferências do perfil", async () => {
    const profile = {
      role: "candidate",
      get skills() { throw new Error("skills devem permanecer sem leitura enquanto F-06 não autoriza"); },
      get preferences() { throw new Error("preferences devem permanecer sem leitura enquanto F-06 não autoriza"); },
    };

    render(
      <MemoryRouter>
        <Home logged userId="candidate-1" profile={profile} profileReady email="ana@example.test" />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Descubra vagas alinhadas ao seu perfil" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Configurar privacidade/i })).toHaveAttribute("href", "/preferencias");
    expect(screen.queryByText(/aguarda liberação de privacidade/i)).not.toBeInTheDocument();
    expect(privacyMocks.authorized).toHaveBeenCalledWith("F-06");
    fireEvent.click(screen.getByRole("button", { name: /Mais recentes/i }));
    expect(screen.getByRole("option", { name: "Mais compatíveis nesta lista" })).toBeDisabled();
  });

  it("usa mensagens distintas para visitante e perfil incompleto", async () => {
    const { rerender } = render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Encontre vagas que combinam com você" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Entrar ou criar conta/i })).toHaveAttribute("href", "/login");

    privacyMocks.authorized.mockResolvedValue(true);
    rerender(
      <MemoryRouter>
        <Home logged userId="candidate-2" profile={{ ...completeCandidate, skills: [] }} profileReady email="ana@example.test" />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Complete seu perfil para encontrar vagas compatíveis" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Completar perfil/i })).toHaveAttribute("href", "/perfil");
  });

  it("ranqueia o conjunto filtrado acumulado ao carregar mais e anuncia a reordenação", async () => {
    privacyMocks.authorized.mockResolvedValue(true);
    peekApprovedJobsPage.mockReturnValue(null);
    const lowMatch = { ...cachedJob, id: "low", title: "Correspondência parcial", stack: ["React", "Node.js"] };
    const highMatch = { ...cachedJob, id: "high", title: "Correspondência forte", stack: ["React"] };
    loadApprovedJobs.mockImplementation(async ({ offset = 0 } = {}) => ({
      jobs: offset ? [highMatch] : [lowMatch],
      count: 2,
    }));

    render(
      <MemoryRouter initialEntries={["/vagas?sort=match&tech=React&country=BR"]}>
        <Home logged userId="candidate-3" profile={completeCandidate} profileReady email="ana@example.test" />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Correspondência parcial" })).toBeInTheDocument();
    expect(loadApprovedJobs).toHaveBeenCalledWith(expect.objectContaining({ tech: ["React"], country: "BR", offset: 0 }));
    const loadMoreButton = screen.getByRole("button", { name: "Carregar mais" });
    loadMoreButton.focus();
    fireEvent.click(loadMoreButton);
    expect(await screen.findByRole("heading", { name: "Correspondência forte" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("reordenado por compatibilidade. 2 vagas"));
    expect([...document.querySelectorAll(".job-title h3")].map((heading) => heading.textContent)).toEqual([
      "Correspondência forte",
      "Correspondência parcial",
    ]);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Todas as vagas carregadas" }));
  });

  it("preserva vagas e cursor de paginação ao mudar apenas a ordenação", async () => {
    privacyMocks.authorized.mockResolvedValue(true);
    peekApprovedJobsPage.mockReturnValue(null);
    const partial = { ...cachedJob, id: "old-a", title: "Match parcial carregado primeiro", stack: ["React", "Node.js"] };
    const exact = { ...cachedJob, id: "old-b", title: "Match exato carregado depois", stack: ["React"], levelCode: "mid", workModelCode: "remote" };
    loadApprovedJobs.mockImplementation(async ({ offset = 0 } = {}) => ({ jobs: [offset ? exact : partial], count: 2 }));

    render(
      <MemoryRouter initialEntries={["/vagas?sort=oldest&tech=React"]}>
        <Home logged userId="candidate-5" profile={completeCandidate} profileReady email="ana@example.test" />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Match parcial carregado primeiro" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(await screen.findByRole("heading", { name: "Match exato carregado depois" })).toBeInTheDocument();
    expect(loadApprovedJobs).toHaveBeenCalledWith(expect.objectContaining({ offset: 1, sort: "oldest" }));
    const callsBeforeSort = loadApprovedJobs.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Mais antigas" }));
    fireEvent.click(screen.getByRole("option", { name: "Mais compatíveis nesta lista" }));

    expect(loadApprovedJobs).toHaveBeenCalledTimes(callsBeforeSort);
    expect([...document.querySelectorAll(".job-title h3")].map((heading) => heading.textContent)).toEqual([
      "Match exato carregado depois",
      "Match parcial carregado primeiro",
    ]);
  });

  it("reinicia a paginação ao alternar entre ordenações cronológicas", async () => {
    peekApprovedJobsPage.mockReturnValue(null);
    const jobsBySortAndOffset = {
      "recent:0": { ...cachedJob, id: "recent-1", title: "Mais recente 1" },
      "recent:1": { ...cachedJob, id: "recent-2", title: "Mais recente 2" },
      "oldest:0": { ...cachedJob, id: "oldest-1", title: "Mais antiga 1" },
      "oldest:1": { ...cachedJob, id: "oldest-2", title: "Mais antiga 2" },
    };
    loadApprovedJobs.mockImplementation(async ({ sort = "recent", offset = 0 } = {}) => ({
      jobs: [jobsBySortAndOffset[`${sort}:${offset}`]],
      count: 4,
    }));

    render(
      <MemoryRouter initialEntries={["/vagas?sort=recent"]}>
        <Home />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Mais recente 1" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(await screen.findByRole("heading", { name: "Mais recente 2" })).toBeInTheDocument();
    expect(loadApprovedJobs).toHaveBeenCalledWith(expect.objectContaining({ offset: 1, sort: "recent" }));

    fireEvent.click(screen.getByRole("button", { name: "Mais recentes" }));
    fireEvent.click(screen.getByRole("option", { name: "Mais antigas" }));

    expect(await screen.findByRole("heading", { name: "Mais antiga 1" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Mais recente 2" })).not.toBeInTheDocument();
    expect(loadApprovedJobs).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0, sort: "oldest" }));

    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(await screen.findByRole("heading", { name: "Mais antiga 2" })).toBeInTheDocument();
    expect(loadApprovedJobs).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 1, sort: "oldest" }));
  });

  it("remove sort=match de visitante mantendo filtros manuais na URL", async () => {
    render(
      <MemoryRouter initialEntries={["/vagas?sort=match&tech=React&query=Node"]}>
        <SearchParamsSnapshot />
        <Home />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId("search-params")).toHaveTextContent("query=Node&tech=React"));
    expect(loadApprovedJobs).toHaveBeenCalledWith(expect.objectContaining({ query: "Node", tech: ["React"] }));
  });

  it("fecha o matching imediatamente após invalidação do cache de privacidade", async () => {
    privacyMocks.authorized.mockResolvedValue(true);
    render(
      <MemoryRouter initialEntries={["/vagas?sort=match&tech=React&country=BR"]}>
        <SearchParamsSnapshot />
        <Home logged userId="candidate-4" profile={completeCandidate} profileReady email="ana@example.test" />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Tecnologias em comum: React")).toBeInTheDocument();
    act(() => privacyMocks.listeners[0]?.(null));
    expect(await screen.findByRole("heading", { name: "Descubra vagas alinhadas ao seu perfil" })).toBeInTheDocument();
    expect(screen.queryByText(/aguarda liberação de privacidade/i)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("search-params")).toHaveTextContent("tech=React&country=BR"));
    expect(screen.queryByText("Tecnologias em comum: React")).not.toBeInTheDocument();
  });

  it("mantém a ordenação personalizada enquanto revalida F-06 ao recuperar o foco", async () => {
    let resolveRevalidation;
    privacyMocks.authorized
      .mockResolvedValueOnce(true)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRevalidation = resolve; }));

    render(
      <MemoryRouter initialEntries={["/vagas?sort=match"]}>
        <Home logged userId="candidate-5" profile={completeCandidate} profileReady email="ana@example.test" />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Tecnologias em comum: React")).toBeInTheDocument();

    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(privacyMocks.authorized).toHaveBeenCalledTimes(2));

    expect(screen.getByText("Tecnologias em comum: React")).toBeInTheDocument();

    await act(async () => {
      resolveRevalidation(true);
      await Promise.resolve();
    });

    expect(screen.getByText("Tecnologias em comum: React")).toBeInTheDocument();
  });

  it("destaca o matching para perfil autorizado sem mostrar aviso de privacidade", async () => {
    privacyMocks.authorized.mockResolvedValue(true);
    render(
      <MemoryRouter initialEntries={["/vagas"]}>
        <SearchParamsSnapshot />
        <Home logged userId="candidate-7" profile={completeCandidate} profileReady email="ana@example.test" />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Encontre vagas que combinam com você" })).toBeInTheDocument();
    expect(screen.queryByText(/aguarda liberação de privacidade/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ver vagas compatíveis/i }));

    expect(await screen.findByRole("heading", { name: "Estas vagas combinam com você" })).toBeInTheDocument();
    expect(screen.getByTestId("search-params")).toHaveTextContent("sort=match");
    expect(screen.getByRole("button", { name: /Voltar à ordem recente/i })).toBeInTheDocument();
  });

  it("fecha o matching após revalidação de foco quando F-06 foi revogado", async () => {
    let resolveRevalidation;
    privacyMocks.authorized
      .mockResolvedValueOnce(true)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRevalidation = resolve; }));

    render(
      <MemoryRouter initialEntries={["/vagas?sort=match"]}>
        <SearchParamsSnapshot />
        <Home logged userId="candidate-6" profile={completeCandidate} profileReady email="ana@example.test" />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Tecnologias em comum: React")).toBeInTheDocument();
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(privacyMocks.authorized).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Tecnologias em comum: React")).toBeInTheDocument();

    await act(async () => {
      resolveRevalidation(false);
      await Promise.resolve();
    });

    expect(await screen.findByRole("heading", { name: "Descubra vagas alinhadas ao seu perfil" })).toBeInTheDocument();
    expect(screen.queryByText(/aguarda liberação de privacidade/i)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("search-params")).not.toHaveTextContent("sort=match"));
    expect(screen.queryByText("Tecnologias em comum: React")).not.toBeInTheDocument();
  });

  it("mostra shimmer no contador no cold miss sem 0 oportunidades", async () => {
    peekApprovedJobsPage.mockReturnValue(null);
    let resolveJobs;
    loadApprovedJobs.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveJobs = resolve;
        }),
    );

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(document.querySelector(".job-card--skeleton")).toBeTruthy();
    expect(document.querySelector(".catalog-result-count-skeleton")).toBeTruthy();
    expect(screen.queryByText(/0 oportunidades encontradas/)).not.toBeInTheDocument();
    expect(screen.getByText("Carregando vagas").className).toContain("sr-only");

    await resolveJobs(pageFor());
    expect(await screen.findByText("1 oportunidades encontradas")).toBeInTheDocument();
    expect(document.querySelector(".catalog-result-count-skeleton")).toBeNull();
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

  it("coloca id e name na busca e nos checkboxes de filtro", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    const search = screen.getByLabelText("Cargo, tecnologia ou empresa");
    expect(search).toHaveAttribute("id", "catalog-query");
    expect(search).toHaveAttribute("name", "q");
    const python = screen.getByRole("checkbox", { name: "Python" });
    expect(python).toHaveAttribute("id", "catalog-tech-python");
    expect(python).toHaveAttribute("name", "catalog-tech");
    const unnamed = [...document.querySelectorAll("input, select, textarea")].filter((el) => !el.id && !el.name);
    expect(unnamed).toEqual([]);
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

  it("descarta loadMore quando o filtro muda antes da resposta", async () => {
    let resolveMore;
    const morePage = new Promise((resolve) => {
      resolveMore = resolve;
    });
    peekApprovedJobsPage.mockImplementation((params) => {
      if (params?.tech?.length) return null;
      return { jobs: [cachedJob], count: 25 };
    });
    loadApprovedJobs.mockImplementation(async (options = {}) => {
      if ((options.offset ?? 0) > 0) return morePage;
      if (options.tech?.includes("Python")) return { jobs: [], count: 0 };
      return { jobs: [cachedJob], count: 25 };
    });

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Carregar mais" }));
    await waitFor(() => {
      expect(loadApprovedJobs).toHaveBeenCalledWith(expect.objectContaining({ offset: 1 }));
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "Python" }));
    expect(await screen.findByRole("heading", { name: "Nenhuma vaga encontrada" })).toBeInTheDocument();

    resolveMore({ jobs: [cachedJob, extraJob], count: 25 });
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Pessoa Engenheira de Dados" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Nenhuma vaga encontrada" })).toBeInTheDocument();
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
    expect(avatar.closest("picture").querySelector('source[type="image/avif"]')).toHaveAttribute(
      "srcset",
      "/avatar-gdgjobs-480.avif 480w, /avatar-gdgjobs-768.avif 768w",
    );
    expect(avatar).not.toHaveAttribute("loading", "lazy");
  });

  it("lê e escreve o param query existente na URL", async () => {
    render(
      <MemoryRouter initialEntries={["/vagas?query=Python"]}>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Cargo, tecnologia ou empresa")).toHaveValue("Python");
    await waitFor(() => {
      expect(loadApprovedJobs).toHaveBeenCalledWith(expect.objectContaining({ query: "Python", offset: 0 }));
    });
    fireEvent.click(screen.getByRole("button", { name: "React" }));
    expect(screen.getByLabelText("Cargo, tecnologia ou empresa")).toHaveValue("React");
    await waitFor(() => {
      expect(loadApprovedJobs).toHaveBeenCalledWith(expect.objectContaining({ query: "React", offset: 0 }));
    });
  });

  it("digitar no campo não busca até Buscar vagas commitar o termo na URL", async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    await waitFor(() => expect(loadApprovedJobs).toHaveBeenCalled());
    const callsBeforeType = loadApprovedJobs.mock.calls.length;
    const search = screen.getByLabelText("Cargo, tecnologia ou empresa");
    fireEvent.change(search, { target: { value: "Node" } });
    expect(search).toHaveValue("Node");
    expect(loadApprovedJobs).toHaveBeenCalledTimes(callsBeforeType);
    expect(loadApprovedJobs).not.toHaveBeenCalledWith(expect.objectContaining({ query: "Node" }));

    fireEvent.click(screen.getByRole("button", { name: /Buscar vagas/i }));
    expect(search).toHaveValue("Node");
    await waitFor(() => {
      expect(loadApprovedJobs).toHaveBeenCalledWith(expect.objectContaining({ query: "Node", offset: 0 }));
    });
    expect(loadApprovedJobs.mock.calls.filter((call) => call[0]?.query === "Node")).toHaveLength(1);
  });

  it("sincroniza o param query com voltar e avançar do histórico", async () => {
    render(
      <MemoryRouter initialEntries={["/vagas?query=Python"]}>
        <CatalogHistory to="/vagas?query=React" />
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Cargo, tecnologia ou empresa")).toHaveValue("Python");
    fireEvent.click(screen.getByRole("button", { name: "Abrir busca" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Cargo, tecnologia ou empresa")).toHaveValue("React");
    });
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Cargo, tecnologia ou empresa")).toHaveValue("Python");
    });
  });

  it("anuncia catálogo vazio para tecnologias assistivas", async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Python" }));
    expect(await screen.findByRole("heading", { name: "Nenhuma vaga encontrada" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Nenhuma vaga encontrada");
  });

  it("abre o detalhe da vaga pelo card com teclado", async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    const card = screen.getByRole("link", { name: /Pessoa Desenvolvedora Front-end/ });
    expect(card).toHaveAttribute("href", "/jobs/1");
    fireEvent.keyDown(card, { key: "Enter" });
    expect(card).toHaveClass("job-card");
  });

  it("abre deep link de país, localidade e faixa e limpa junto com os filtros existentes", async () => {
    render(
      <MemoryRouter initialEntries={["/vagas?country=BR&place=salvador&salaryMin=800000&salaryMax=1200000&tech=React"]}>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("País")).toHaveValue("BR");
    expect(screen.getByLabelText("Localidade")).toHaveValue("salvador");
    expect(screen.getByLabelText("Mínimo")).toHaveValue("8000");
    expect(screen.getByLabelText("Máximo")).toHaveValue("12000");
    expect(screen.getByRole("checkbox", { name: "React" })).toBeChecked();
    expect(screen.getByText("Com um país escolhido, vagas sem país ficam de fora.")).toBeInTheDocument();
    expect(screen.getByText("Com a faixa preenchida, vagas A combinar ficam de fora.")).toBeInTheDocument();
    await waitFor(() => {
      expect(loadApprovedJobs).toHaveBeenCalledWith(expect.objectContaining({
        country: "BR",
        place: "salvador",
        salaryMin: 800000,
        salaryMax: 1200000,
        tech: ["React"],
        offset: 0,
      }));
    });

    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(screen.getByLabelText("País")).toHaveValue("");
    expect(screen.getByLabelText("Localidade")).toHaveValue("");
    await waitFor(() => {
      expect(loadApprovedJobs).toHaveBeenCalledWith(expect.objectContaining({
        country: "",
        place: "",
        salaryMin: null,
        salaryMax: null,
        tech: [],
      }));
    });
  });

  it("restaura o país ao voltar no histórico", async () => {
    render(
      <MemoryRouter initialEntries={["/vagas?country=BR"]}>
        <CatalogHistory to="/vagas?country=PT" />
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("País")).toHaveValue("BR");
    fireEvent.click(screen.getByRole("button", { name: "Abrir busca" }));
    await waitFor(() => expect(screen.getByLabelText("País")).toHaveValue("PT"));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    await waitFor(() => expect(screen.getByLabelText("País")).toHaveValue("BR"));
  });

  it("grava a faixa em centavos e recusa mínimo maior que o máximo", async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Mínimo"), { target: { value: "8000" } });
    fireEvent.change(screen.getByLabelText("Máximo"), { target: { value: "12000" } });
    fireEvent.blur(screen.getByLabelText("Máximo"));
    await waitFor(() => {
      expect(loadApprovedJobs).toHaveBeenCalledWith(expect.objectContaining({
        salaryMin: 800000,
        salaryMax: 1200000,
      }));
    });

    fireEvent.change(screen.getByLabelText("Mínimo"), { target: { value: "20000" } });
    fireEvent.blur(screen.getByLabelText("Mínimo"));
    expect(screen.getByRole("alert")).toHaveTextContent("O mínimo não pode ser maior que o máximo.");
  });

  it("empty de erro do catálogo é genérico, tem retry e não cita .env.local", async () => {
    peekApprovedJobsPage.mockReturnValue(null);
    loadApprovedJobs.mockRejectedValue(new Error("network"));

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Catálogo indisponível" })).toBeInTheDocument();
    expect(screen.getByText(/Não foi possível carregar as vagas/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\.env\.local/);
  });

  it("erro de rede não apaga vagas já no cache", async () => {
    peekApprovedJobsPage.mockReturnValue({ jobs: [cachedJob], count: 1 });
    loadApprovedJobs.mockRejectedValue(new Error("network"));

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Não foi possível atualizar o catálogo/i);
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\.env\.local/);
  });

  it("mostra o salário mapeado no card", async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByText("A combinar")).toBeInTheDocument();
  });
});
