import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
});
