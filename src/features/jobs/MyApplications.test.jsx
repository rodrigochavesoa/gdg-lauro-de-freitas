import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const loadMyApplications = vi.fn();

vi.mock("./apply-api.js", async () => {
  const actual = await vi.importActual("./apply-api.js");
  return {
    ...actual,
    loadMyApplications: (...args) => loadMyApplications(...args),
    withdrawApplication: vi.fn(),
  };
});

import { MyApplications } from "./MyApplications.jsx";

describe("MyApplications", () => {
  it("mostra empty state quando não há candidaturas", async () => {
    loadMyApplications.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <MyApplications />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Você ainda não se candidatou" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver vagas" })).toHaveAttribute("href", "/");
  });

  it("mostra retirar quando o status é submitted", async () => {
    loadMyApplications.mockResolvedValue([
      {
        id: "a1",
        jobId: "job-1",
        status: "submitted",
        jobTitle: "Pessoa Desenvolvedora Front-end",
        companyName: "Nuvem Lauro Demo",
        updatedAt: "2026-09-07T00:00:00.000Z",
      },
    ]);
    render(
      <MemoryRouter>
        <MyApplications />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pessoa Desenvolvedora Front-end" })).toHaveAttribute("href", "/jobs/job-1");
    expect(screen.getByRole("button", { name: "Retirar candidatura" })).toBeInTheDocument();
    expect(screen.getByText("Enviada")).toBeInTheDocument();
  });
});
