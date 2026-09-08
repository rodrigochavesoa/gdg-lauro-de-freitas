import React from "react";
import { render, screen } from "@testing-library/react";
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
});
