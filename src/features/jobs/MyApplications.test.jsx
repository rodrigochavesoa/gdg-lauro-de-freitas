import React from "react";
import { render, screen } from "@testing-library/react";
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

import { MyApplications } from "./MyApplications.jsx";

describe("MyApplications", () => {
  beforeEach(() => {
    loadMyApplications.mockReset();
    peekMyApplicationsCache.mockReset();
    peekMyApplicationsCache.mockReturnValue(null);
    withdrawApplication.mockReset();
  });

  it("mostra empty state quando não há candidaturas", async () => {
    loadMyApplications.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <MyApplications userId="u1" />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Você ainda não se candidatou" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver vagas" })).toHaveAttribute("href", "/vagas");
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
    resolveList([]);
    expect(await screen.findByRole("heading", { name: "Você ainda não se candidatou" })).toBeInTheDocument();
    expect(document.querySelector(".job-card--skeleton-static")).toBeNull();
  });

  it("reusa o cache no remount e não mostra gate nem skeleton", async () => {
    peekMyApplicationsCache.mockReturnValue([
      {
        id: "a1",
        jobId: "job-1",
        status: "submitted",
        jobTitle: "Pessoa Desenvolvedora Front-end",
        companyName: "Nuvem Lauro Demo",
        updatedAt: "2026-09-07T00:00:00.000Z",
      },
    ]);
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
        <MyApplications userId="u1" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(document.querySelector(".job-card--skeleton")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Carregando candidaturas" })).not.toBeInTheDocument();
    expect(loadMyApplications).toHaveBeenCalledWith({ userId: "u1", forceRefresh: true });
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
        <MyApplications userId="u1" />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pessoa Desenvolvedora Front-end" })).toHaveAttribute("href", "/jobs/job-1");
    expect(screen.getByRole("button", { name: "Retirar candidatura" })).toBeInTheDocument();
    expect(screen.getByText("Enviada")).toBeInTheDocument();
  });
});
