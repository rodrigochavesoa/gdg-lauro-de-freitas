import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
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

vi.mock("./jobs-api.js", () => ({
  peekApprovedJobsPage: (...args) => peekApprovedJobsPage(...args),
  loadApprovedJobs: (...args) => loadApprovedJobs(...args),
  CATALOG_PAGE_SIZE: 24,
}));

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

  it("mostra o salário mapeado no card", async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByText("A combinar")).toBeInTheDocument();
  });
});
