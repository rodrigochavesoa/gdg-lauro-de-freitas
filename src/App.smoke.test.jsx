import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./lib/jobs-api.js", () => ({
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

describe("App smoke", () => {
  it("renderiza a home com busca e listagem de vagas aprovadas", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /carreira em tech/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Cargo, tecnologia ou empresa")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("4 oportunidades encontradas")).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
  });
});
