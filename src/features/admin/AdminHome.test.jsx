import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadAdminDashboardJobCounts = vi.hoisted(() => vi.fn());
const countIngestionsNeedingAttention = vi.hoisted(() => vi.fn());

vi.mock("./admin-dashboard-api.js", () => ({
  loadAdminDashboardJobCounts: (...args) => loadAdminDashboardJobCounts(...args),
  countIngestionsNeedingAttention: (...args) => countIngestionsNeedingAttention(...args),
}));

import { AdminHome } from "./AdminHome.jsx";

const jobCounts = {
  pendingCuration: 2,
  approved: 1,
  rejectedJobs: 0,
  rejectedQueue: 0,
  pendingJobs: 2,
};

function homeTree(role, refreshKey = 0) {
  return (
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<Outlet context={{ profile: { role } }} />}>
          <Route index element={<AdminHome refreshKey={refreshKey} />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

function renderHome(role, refreshKey = 0) {
  return render(homeTree(role, refreshKey));
}

describe("AdminHome", () => {
  beforeEach(() => {
    loadAdminDashboardJobCounts.mockReset();
    countIngestionsNeedingAttention.mockReset();
    loadAdminDashboardJobCounts.mockResolvedValue(jobCounts);
    countIngestionsNeedingAttention.mockResolvedValue(0);
  });

  it("mostra a estrutura antes dos counts e não trata pendente como zero", async () => {
    let resolveJobs;
    let resolveIngest;
    loadAdminDashboardJobCounts.mockImplementation(
      () => new Promise((resolve) => { resolveJobs = resolve; }),
    );
    countIngestionsNeedingAttention.mockImplementation(
      () => new Promise((resolve) => { resolveIngest = resolve; }),
    );
    renderHome("admin");
    expect(screen.getByRole("heading", { name: "Painel" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Visão geral" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Curadoria" })).toBeInTheDocument();
    expect(screen.queryByText("Fila de revisão em dia")).not.toBeInTheDocument();
    expect(screen.queryByText("Carregando indicadores…")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ver ingestões/ })).not.toBeInTheDocument();
    expect(document.querySelector(".admin-dashboard-stat--skeleton")).toBeTruthy();

    resolveJobs(jobCounts);
    expect(await screen.findByText("2 vagas aguardam revisão")).toBeInTheDocument();
    expect(document.querySelector(".admin-dashboard-stat--skeleton")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Ver ingestões/ })).not.toBeInTheDocument();

    resolveIngest(3);
    expect(await screen.findByRole("link", { name: "Ver ingestões (3)" })).toBeInTheDocument();
    expect(document.querySelector(".admin-dashboard-stat--skeleton")).toBeNull();
  });

  it("curator não dispara a contagem de ingestão", async () => {
    renderHome("curator");
    expect(await screen.findByText("2 vagas aguardam revisão")).toBeInTheDocument();
    expect(countIngestionsNeedingAttention).not.toHaveBeenCalled();
    expect(screen.queryByText("Ingestões pendentes")).not.toBeInTheDocument();
  });

  it("falha da contagem de ingestão mantém as vagas e o alerta", async () => {
    countIngestionsNeedingAttention.mockRejectedValue(new Error("contagem indisponível"));
    renderHome("admin");
    expect(await screen.findByText("2 vagas aguardam revisão")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("contagem indisponível");
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("falha das contagens de vagas não publica zeros", async () => {
    loadAdminDashboardJobCounts.mockRejectedValue(new Error("painel indisponível"));
    renderHome("admin");
    expect(screen.getByRole("heading", { name: "Painel" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("painel indisponível");
    expect(screen.queryByText("Fila de revisão em dia")).not.toBeInTheDocument();
    expect(screen.queryByText("0 vagas aguardam revisão")).not.toBeInTheDocument();
    expect(document.querySelector(".admin-dashboard-stat--skeleton")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(loadAdminDashboardJobCounts).toHaveBeenCalledTimes(2));
  });

  it("recarregar preserva o último valor e marca aria-busy", async () => {
    let resolveReload;
    const view = renderHome("admin", 0);
    expect(await screen.findByText("2 vagas aguardam revisão")).toBeInTheDocument();

    loadAdminDashboardJobCounts.mockImplementation(
      () => new Promise((resolve) => { resolveReload = resolve; }),
    );
    countIngestionsNeedingAttention.mockImplementation(() => new Promise(() => {}));
    view.rerender(homeTree("admin", 1));

    expect(screen.getByText("2 vagas aguardam revisão")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Curadoria" }).closest("section")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Fila de revisão em dia")).not.toBeInTheDocument();
    expect(screen.queryByText("0 vagas aguardam revisão")).not.toBeInTheDocument();

    resolveReload({ ...jobCounts, pendingCuration: 4, pendingJobs: 4 });
    expect(await screen.findByText("4 vagas aguardam revisão")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Curadoria" }).closest("section")).not.toHaveAttribute("aria-busy", "true");
  });
});
