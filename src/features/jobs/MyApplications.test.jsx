import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadMyApplications = vi.hoisted(() => vi.fn());
const peekMyApplicationsCache = vi.hoisted(() => vi.fn(() => null));
const withdrawApplication = vi.hoisted(() => vi.fn());

vi.mock("./apply-api.js", async () => {
  const actual = await vi.importActual("./apply-api.js");
  return {
    ...actual,
    loadMyApplications: (...args) => loadMyApplications(...args),
    peekMyApplicationsCache: (...args) => peekMyApplicationsCache(...args),
    withdrawApplication: (...args) => withdrawApplication(...args),
  };
});

import { APPLICATION_LIST_LIMIT } from "./apply-api.js";
import { MyApplications } from "./MyApplications.jsx";

function applicationItem(index) {
  return {
    id: `a${index}`,
    jobId: `job-${index}`,
    status: "submitted",
    jobTitle: index === 0 ? "Pessoa Desenvolvedora Front-end" : `Vaga ${index}`,
    companyName: "Nuvem Lauro Demo",
    updatedAt: "2026-09-07T00:00:00.000Z",
  };
}

function applicationsPage(items, hasMore = false) {
  return { applications: items, hasMore };
}

describe("MyApplications", () => {
  beforeEach(() => {
    loadMyApplications.mockReset();
    peekMyApplicationsCache.mockReset();
    peekMyApplicationsCache.mockReturnValue(null);
    withdrawApplication.mockReset();
  });

  it("mostra empty state quando não há candidaturas", async () => {
    loadMyApplications.mockResolvedValue(applicationsPage([]));
    render(
      <MemoryRouter>
        <MyApplications userId="u1" />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Você ainda não se candidatou" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver vagas" })).toHaveAttribute("href", "/vagas");
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });

  it("mostra skeleton estático no cold miss sem empty Carregando candidaturas", async () => {
    let resolveList;
    loadMyApplications.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    render(
      <MemoryRouter>
        <MyApplications userId="u1" />
      </MemoryRouter>,
    );
    expect(document.querySelectorAll(".job-card--skeleton-static")).toHaveLength(3);
    expect(screen.queryByRole("heading", { name: "Carregando candidaturas" })).not.toBeInTheDocument();
    expect(screen.queryByText("Carregando…")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Você ainda não se candidatou" })).not.toBeInTheDocument();
    expect(loadMyApplications).toHaveBeenCalledWith({ userId: "u1", forceRefresh: false });
    resolveList(applicationsPage([]));
    expect(await screen.findByRole("heading", { name: "Você ainda não se candidatou" })).toBeInTheDocument();
    expect(document.querySelector(".job-card--skeleton-static")).toBeNull();
  });

  it("reusa o cache no remount e não mostra gate nem skeleton", async () => {
    peekMyApplicationsCache.mockReturnValue(
      applicationsPage([
        {
          id: "a1",
          jobId: "job-1",
          status: "submitted",
          jobTitle: "Pessoa Desenvolvedora Front-end",
          companyName: "Nuvem Lauro Demo",
          updatedAt: "2026-09-07T00:00:00.000Z",
        },
      ]),
    );
    loadMyApplications.mockResolvedValue(
      applicationsPage([
        {
          id: "a1",
          jobId: "job-1",
          status: "submitted",
          jobTitle: "Pessoa Desenvolvedora Front-end",
          companyName: "Nuvem Lauro Demo",
          updatedAt: "2026-09-07T00:00:00.000Z",
        },
      ]),
    );
    render(
      <MemoryRouter>
        <MyApplications userId="u1" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(document.querySelector(".job-card--skeleton")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Carregando candidaturas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
    expect(loadMyApplications).toHaveBeenCalledWith({ userId: "u1", forceRefresh: true });
  });

  it("permite repetir o carregamento após falha sem cache", async () => {
    loadMyApplications
      .mockRejectedValueOnce(new Error("Falha transitória."))
      .mockResolvedValueOnce(applicationsPage([applicationItem(0)]));
    render(
      <MemoryRouter>
        <MyApplications userId="u1" />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha transitória.");
    expect(screen.queryByRole("heading", { name: "Você ainda não se candidatou" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(loadMyApplications).toHaveBeenCalledTimes(2);
  });

  it("mostra retirar quando o status é submitted", async () => {
    loadMyApplications.mockResolvedValue(
      applicationsPage([
        {
          id: "a1",
          jobId: "job-1",
          status: "submitted",
          jobTitle: "Pessoa Desenvolvedora Front-end",
          companyName: "Nuvem Lauro Demo",
          updatedAt: "2026-09-07T00:00:00.000Z",
        },
      ]),
    );
    render(
      <MemoryRouter>
        <MyApplications userId="u1" />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pessoa Desenvolvedora Front-end" })).toHaveAttribute("href", "/jobs/job-1");
    expect(screen.getByRole("button", { name: "Retirar candidatura" })).toBeInTheDocument();
    expect(screen.getByText("Enviada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });

  it("com 100 rows e hasMore mostra Carregar mais e acumula a página 2", async () => {
    const firstPage = Array.from({ length: APPLICATION_LIST_LIMIT }, (_, index) => applicationItem(index));
    loadMyApplications
      .mockResolvedValueOnce(applicationsPage(firstPage, true))
      .mockResolvedValueOnce(applicationsPage([applicationItem(APPLICATION_LIST_LIMIT)], false));
    render(
      <MemoryRouter>
        <MyApplications userId="u1" />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Carregar mais" }));
    expect(await screen.findByRole("heading", { name: `Vaga ${APPLICATION_LIST_LIMIT}` })).toBeInTheDocument();
    expect(loadMyApplications).toHaveBeenLastCalledWith({ userId: "u1", page: 2 });
    expect(screen.getByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  }, 15_000);

  it("refresh atrasado da página 1 em cache não apaga a página 2", async () => {
    const cached = applicationItem(0);
    const page2 = applicationItem(1);
    const refreshed = { ...applicationItem(0), jobTitle: "Página 1 atualizada" };
    let resolveRefresh;
    peekMyApplicationsCache.mockReturnValue(applicationsPage([cached], true));
    loadMyApplications.mockImplementation(async (opts = {}) => {
      if ((opts.page ?? 1) === 1) {
        return new Promise((resolve) => {
          resolveRefresh = resolve;
        });
      }
      return applicationsPage([page2], false);
    });

    render(
      <MemoryRouter>
        <MyApplications userId="u1" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(await screen.findByRole("heading", { name: "Vaga 1" })).toBeInTheDocument();

    await act(async () => {
      resolveRefresh(applicationsPage([refreshed], true));
    });
    expect(screen.getByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vaga 1" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Página 1 atualizada" })).not.toBeInTheDocument();
  });

  it("mostra hero pontilhado, busca e filtros no padrão da comunidade", async () => {
    loadMyApplications.mockResolvedValue(applicationsPage([]));
    render(
      <MemoryRouter>
        <MyApplications userId="u1" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Minhas candidaturas" })).toBeInTheDocument();
    expect(document.querySelector(".hero.community-browse-hero")).toBeTruthy();
    expect(document.querySelector(".home-divider__curve")).toBeTruthy();
    expect(document.querySelector(".community-browse-searchbox")).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "Título da vaga, empresa ou status" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /buscar candidaturas/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /filtros/i })).toBeDisabled();
    expect(await screen.findByRole("heading", { name: "Você ainda não se candidatou" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Título da vaga, empresa ou status" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /filtros/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /filtros/i })).toHaveAttribute("aria-expanded", "false");
  });

  it("filtra a lista carregada por status e por busca enviada", async () => {
    loadMyApplications.mockResolvedValue(
      applicationsPage([
        {
          id: "a1",
          jobId: "job-1",
          status: "submitted",
          jobTitle: "Pessoa Desenvolvedora Front-end",
          companyName: "Nuvem Lauro Demo",
          updatedAt: "2026-09-07T00:00:00.000Z",
        },
        {
          id: "a2",
          jobId: "job-2",
          status: "withdrawn",
          jobTitle: "Pessoa Analista de Dados",
          companyName: "Oficina Norte",
          updatedAt: "2026-09-08T00:00:00.000Z",
        },
      ]),
    );
    render(
      <MemoryRouter>
        <MyApplications userId="u1" />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /filtros/i }));
    expect(screen.getByRole("button", { name: /filtros/i })).toHaveAttribute("aria-expanded", "true");
    fireEvent.change(screen.getByLabelText("Filtrar por status da candidatura"), { target: { value: "withdrawn" } });
    expect(screen.queryByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pessoa Analista de Dados" })).toBeInTheDocument();
    expect(document.querySelector(".job-card .featured").textContent).toBe("Retirada");
    expect(screen.queryByRole("button", { name: "Retirar candidatura" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filtrar por status da candidatura"), { target: { value: "" } });
    const search = screen.getByRole("searchbox", { name: "Título da vaga, empresa ou status" });
    fireEvent.change(search, { target: { value: "oficina" } });
    expect(screen.getByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /buscar candidaturas/i }));
    expect(screen.queryByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pessoa Analista de Dados" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Você ainda não se candidatou" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Nenhuma candidatura encontrada" })).not.toBeInTheDocument();
  });

  it("diz que a busca vazia ainda pode ter páginas não carregadas", async () => {
    loadMyApplications.mockResolvedValue(
      applicationsPage([
        {
          id: "a1",
          jobId: "job-1",
          status: "submitted",
          jobTitle: "Pessoa Desenvolvedora Front-end",
          companyName: "Nuvem Lauro Demo",
          updatedAt: "2026-09-07T00:00:00.000Z",
        },
      ], true),
    );
    render(
      <MemoryRouter>
        <MyApplications userId="u1" />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Título da vaga, empresa ou status" }), {
      target: { value: "inexistente" },
    });
    fireEvent.click(screen.getByRole("button", { name: /buscar candidaturas/i }));
    expect(screen.getByRole("heading", { name: "Nenhuma candidatura encontrada" })).toBeInTheDocument();
    expect(screen.getByText(/já carregadas corresponde/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Carregar mais" })).toBeInTheDocument();
  });

  it("mantém as linhas em cache quando o refresh falha", async () => {
    peekMyApplicationsCache.mockReturnValue(
      applicationsPage([
        {
          id: "a1",
          jobId: "job-1",
          status: "submitted",
          jobTitle: "Pessoa Desenvolvedora Front-end",
          companyName: "Nuvem Lauro Demo",
          updatedAt: "2026-09-07T00:00:00.000Z",
        },
      ]),
    );
    loadMyApplications.mockRejectedValue(new Error("Falha ao atualizar"));
    render(
      <MemoryRouter>
        <MyApplications userId="u1" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao atualizar");
    expect(screen.getByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Você ainda não se candidatou" })).not.toBeInTheDocument();
  });

  it("troca de usuário não renderiza o histórico anterior e ignora a resposta atrasada", async () => {
    let resolveFirst;
    peekMyApplicationsCache.mockImplementation((id) => (
      id === "u1"
        ? applicationsPage([
          {
            id: "a1",
            jobId: "job-1",
            status: "submitted",
            jobTitle: "Vaga da conta anterior",
            companyName: "Empresa A",
            updatedAt: "2026-09-07T00:00:00.000Z",
          },
        ])
        : null
    ));
    loadMyApplications.mockImplementation(({ userId }) => {
      if (userId === "u1") {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve(applicationsPage([
        {
          id: "b1",
          jobId: "job-2",
          status: "submitted",
          jobTitle: "Vaga da conta atual",
          companyName: "Empresa B",
          updatedAt: "2026-09-08T00:00:00.000Z",
        },
      ]));
    });
    const view = render(
      <MemoryRouter>
        <MyApplications userId="u1" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Vaga da conta anterior" })).toBeInTheDocument();
    view.rerender(
      <MemoryRouter>
        <MyApplications userId="u2" />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("heading", { name: "Vaga da conta anterior" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Vaga da conta atual" })).toBeInTheDocument();
    await act(async () => {
      resolveFirst(applicationsPage([
        {
          id: "a1",
          jobId: "job-1",
          status: "submitted",
          jobTitle: "Vaga da conta anterior",
          companyName: "Empresa A",
          updatedAt: "2026-09-07T00:00:00.000Z",
        },
      ]));
    });
    expect(screen.queryByRole("heading", { name: "Vaga da conta anterior" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vaga da conta atual" })).toBeInTheDocument();
  });

  it("logout limpa as candidaturas que estavam na tela", async () => {
    peekMyApplicationsCache.mockImplementation((id) => (
      id
        ? applicationsPage([
          {
            id: "a1",
            jobId: "job-1",
            status: "submitted",
            jobTitle: "Vaga da conta anterior",
            companyName: "Empresa A",
            updatedAt: "2026-09-07T00:00:00.000Z",
          },
        ])
        : null
    ));
    loadMyApplications.mockResolvedValue(applicationsPage([]));
    const view = render(
      <MemoryRouter>
        <MyApplications userId="u1" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Vaga da conta anterior" })).toBeInTheDocument();
    view.rerender(
      <MemoryRouter>
        <MyApplications userId="" />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("heading", { name: "Vaga da conta anterior" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Você ainda não se candidatou" })).not.toBeInTheDocument();
  });
});
