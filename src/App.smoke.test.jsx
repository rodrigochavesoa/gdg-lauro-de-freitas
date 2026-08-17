import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
      stack: ["Python"],
      salary: "A combinar",
      featured: false,
      description: "Fictícia",
      about: "Empresa fictícia",
      responsibilities: ["Pipelines"],
    },
  ],
}));

import { App } from "./App.jsx";

async function renderHome() {
  render(<App />);
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

  it("abre o detalhe da vaga a partir do catálogo", async () => {
    await renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Ver vaga Pessoa Desenvolvedora Front-end" }));
    expect(screen.getByRole("button", { name: /Voltar para vagas/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Candidatar-se com 1 clique/i })).toBeInTheDocument();
  });

  it("abre o Login a partir de Entrar", async () => {
    await renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(screen.getByRole("heading", { name: "Entre na sua conta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar com Google/i })).toBeInTheDocument();
  });

  it("abre o menu mobile com os destinos existentes", async () => {
    await renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    const mobile = document.getElementById("mobile-navigation");
    expect(mobile).toBeTruthy();
    expect(within(mobile).getByRole("button", { name: "Vagas" })).toBeInTheDocument();
    expect(within(mobile).getByRole("button", { name: "Para empresas" })).toBeInTheDocument();
    expect(within(mobile).getByRole("button", { name: "Comunidade" })).toBeInTheDocument();
    expect(within(mobile).getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });
});
