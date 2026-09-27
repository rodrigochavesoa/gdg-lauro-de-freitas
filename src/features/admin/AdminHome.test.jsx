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

const clearCounts = {
  pendingCuration: 0,
  approved: 4,
  rejectedJobs: 0,
  rejectedQueue: 0,
  pendingJobs: 0,
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

function focusSection() {
  return document.querySelector(".admin-dashboard-focus");
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
    expect(screen.getByRole("heading", { name: "Próxima ação" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Curadoria" })).not.toBeInTheDocument();
    expect(screen.queryByText("Fila de revisão em dia")).not.toBeInTheDocument();
    expect(screen.queryByText("Atenção")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Revisar fila" })).not.toBeInTheDocument();
    expect(screen.queryByText("Carregando indicadores…")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ver ingestões/ })).not.toBeInTheDocument();
    expect(document.querySelector(".admin-dashboard-stat--skeleton")).toBeTruthy();
    expect(focusSection()).toHaveAttribute("aria-busy", "true");

    resolveJobs(jobCounts);
    expect(await screen.findByRole("heading", { name: "Curadoria" })).toBeInTheDocument();
    expect(screen.getByText("2 vagas aguardam revisão")).toBeInTheDocument();
    expect(screen.getByText("Atenção")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revisar fila" })).toHaveAttribute("href", "/admin/curadoria");
    expect(focusSection()).toHaveClass("admin-dashboard-focus--attention");
    expect(document.querySelector(".admin-dashboard-stat--skeleton")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Ver ingestões/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Fila de revisão em dia")).not.toBeInTheDocument();

    resolveIngest(3);
    expect(await screen.findByRole("link", { name: "Ver ingestões (3)" })).toBeInTheDocument();
    expect(document.querySelector(".admin-dashboard-stat--skeleton")).toBeNull();
    expect(document.querySelector(".admin-dashboard-stat--ingest-attention")).toHaveTextContent("3");
    expect(screen.getByRole("link", { name: "Revisar fila" })).toBeInTheDocument();
  });

  it("com pendência de curadoria destaca a ação de revisar a fila", async () => {
    countIngestionsNeedingAttention.mockResolvedValue(1);
    renderHome("admin");
    expect(await screen.findByRole("heading", { name: "Curadoria" })).toBeInTheDocument();
    expect(screen.getByText("2 vagas aguardam revisão")).toBeInTheDocument();
    expect(screen.getByText("Atenção")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revisar fila" })).toHaveClass("primary");
    expect(await screen.findByRole("link", { name: "Ver ingestões (1)" })).toHaveAttribute("href", "/admin/ingestao");
    expect(screen.queryByText("Fila de revisão em dia")).not.toBeInTheDocument();
    expect(document.querySelector(".admin-dashboard-stat--ingest-attention")).toHaveTextContent("Ingestões pendentes");
  });

  it("sem pendência mostra estado positivo e não mantém o alerta laranja", async () => {
    let resolveIngest;
    loadAdminDashboardJobCounts.mockResolvedValue(clearCounts);
    countIngestionsNeedingAttention.mockImplementation(
      () => new Promise((resolve) => { resolveIngest = resolve; }),
    );
    renderHome("admin");
    expect(await screen.findByText("4")).toBeInTheDocument();
    expect(screen.queryByText("Fila de revisão em dia")).not.toBeInTheDocument();
    expect(screen.queryByText("Atenção")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Revisar fila" })).not.toBeInTheDocument();
    expect(focusSection()).toHaveAttribute("aria-busy", "true");

    resolveIngest(0);
    expect(await screen.findByRole("heading", { name: "Em dia" })).toBeInTheDocument();
    expect(screen.getByText("Fila de revisão em dia")).toBeInTheDocument();
    expect(screen.queryByText("Atenção")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Revisar fila" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ver ingestões/ })).not.toBeInTheDocument();
    expect(focusSection()).toHaveClass("admin-dashboard-focus--clear");
    expect(focusSection()).not.toHaveClass("admin-dashboard-focus--attention");
    expect(document.querySelector(".admin-dashboard-stat--ingest-attention")).toHaveTextContent("0");
  });

  it("prioriza ingestão quando a curadoria está em dia e há ingestões pendentes", async () => {
    loadAdminDashboardJobCounts.mockResolvedValue(clearCounts);
    countIngestionsNeedingAttention.mockResolvedValue(3);
    renderHome("admin");
    expect(await screen.findByRole("heading", { name: "Ingestões pendentes" })).toBeInTheDocument();
    expect(screen.getByText("3 ingestões pendentes")).toBeInTheDocument();
    expect(screen.getByText("Atenção")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver ingestões (3)" })).toHaveAttribute("href", "/admin/ingestao");
    expect(screen.queryByRole("link", { name: "Revisar fila" })).not.toBeInTheDocument();
    expect(screen.queryByText("Fila de revisão em dia")).not.toBeInTheDocument();
    expect(focusSection()).toHaveClass("admin-dashboard-focus--attention");
  });

  it("prioriza vagas quando essa é a próxima pendência do resumo", async () => {
    loadAdminDashboardJobCounts.mockResolvedValue({
      ...clearCounts,
      pendingJobs: 4,
    });
    countIngestionsNeedingAttention.mockResolvedValue(0);
    renderHome("admin");
    expect(await screen.findByRole("heading", { name: "Vagas" })).toBeInTheDocument();
    expect(screen.getByText("4 vagas pendentes")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver vagas (4 pendentes)" })).toHaveAttribute("href", "/admin/vagas");
    expect(screen.getByText("Atenção")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Revisar fila" })).not.toBeInTheDocument();
    expect(screen.queryByText("Fila de revisão em dia")).not.toBeInTheDocument();
  });

  it("curator não dispara a contagem de ingestão", async () => {
    renderHome("curator");
    expect(await screen.findByText("2 vagas aguardam revisão")).toBeInTheDocument();
    expect(countIngestionsNeedingAttention).not.toHaveBeenCalled();
    expect(screen.queryByText("Ingestões pendentes")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revisar fila" })).toBeInTheDocument();
  });

  it("curator sem fila mostra o estado positivo sem consultar ingestão", async () => {
    loadAdminDashboardJobCounts.mockResolvedValue({
      pendingCuration: 0,
      approved: 0,
      rejectedJobs: 0,
      rejectedQueue: 0,
      pendingJobs: 0,
    });
    renderHome("curator");
    expect(await screen.findByText("Fila de revisão em dia")).toBeInTheDocument();
    expect(countIngestionsNeedingAttention).not.toHaveBeenCalled();
    expect(screen.queryByText("Atenção")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Revisar fila" })).not.toBeInTheDocument();
  });

  it("moderator não consulta ingestão nem vê cards de admin", async () => {
    renderHome("moderator");
    expect(await screen.findByText("2 vagas aguardam revisão")).toBeInTheDocument();
    expect(countIngestionsNeedingAttention).not.toHaveBeenCalled();
    expect(screen.queryByText("Ingestões pendentes")).not.toBeInTheDocument();
    expect(screen.queryByText("Publicadas")).not.toBeInTheDocument();
    expect(screen.queryByText("Rejeitadas")).not.toBeInTheDocument();
    expect(screen.queryByText("Na fila")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Visão geral" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revisar fila" })).toHaveAttribute("href", "/admin/curadoria");
  });

  it("moderator sem fila mostra Em dia sem consultar ingestão", async () => {
    loadAdminDashboardJobCounts.mockResolvedValue({
      pendingCuration: 0,
      approved: 0,
      rejectedJobs: 0,
      rejectedQueue: 0,
      pendingJobs: 0,
    });
    renderHome("moderator");
    expect(await screen.findByText("Fila de revisão em dia")).toBeInTheDocument();
    expect(countIngestionsNeedingAttention).not.toHaveBeenCalled();
    expect(screen.queryByText("Ingestões pendentes")).not.toBeInTheDocument();
    expect(screen.queryByText("Publicadas")).not.toBeInTheDocument();
    expect(screen.queryByText("Atenção")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Revisar fila" })).not.toBeInTheDocument();
  });

  it("falha da contagem de ingestão mantém as vagas e o alerta", async () => {
    countIngestionsNeedingAttention.mockRejectedValue(new Error("contagem indisponível"));
    renderHome("admin");
    expect(await screen.findByText("2 vagas aguardam revisão")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("contagem indisponível");
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revisar fila" })).toBeInTheDocument();
  });

  it("falha da ingestão com curadoria em dia não confirma o estado positivo", async () => {
    loadAdminDashboardJobCounts.mockResolvedValue(clearCounts);
    countIngestionsNeedingAttention.mockRejectedValue(new Error("contagem indisponível"));
    renderHome("admin");
    expect(await screen.findByRole("alert")).toHaveTextContent("contagem indisponível");
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("Fila de revisão em dia")).not.toBeInTheDocument();
    expect(screen.queryByText("Atenção")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Revisar fila" })).not.toBeInTheDocument();
    expect(focusSection()).toHaveClass("admin-dashboard-focus--unavailable");
  });

  it("falha das contagens de vagas não publica zeros", async () => {
    loadAdminDashboardJobCounts.mockRejectedValue(new Error("painel indisponível"));
    renderHome("admin");
    expect(screen.getByRole("heading", { name: "Painel" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("painel indisponível");
    expect(screen.queryByText("Fila de revisão em dia")).not.toBeInTheDocument();
    expect(screen.queryByText("0 vagas aguardam revisão")).not.toBeInTheDocument();
    expect(screen.queryByText("Atenção")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Revisar fila" })).not.toBeInTheDocument();
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

  it("falha no refresh não confirma Em dia com o valor em cache", async () => {
    let rejectJobs;
    loadAdminDashboardJobCounts.mockResolvedValue(clearCounts);
    countIngestionsNeedingAttention.mockResolvedValue(0);
    const view = renderHome("admin", 0);
    expect(await screen.findByText("Fila de revisão em dia")).toBeInTheDocument();

    loadAdminDashboardJobCounts.mockImplementation(
      () => new Promise((_, reject) => { rejectJobs = reject; }),
    );
    view.rerender(homeTree("admin", 1));

    const published = screen.getByText("Publicadas").closest(".admin-dashboard-stat");
    expect(published).toHaveAttribute("aria-busy", "true");
    expect(published).toHaveTextContent("4");
    expect(screen.getByText("Fila de revisão em dia")).toBeInTheDocument();

    rejectJobs(new Error("painel indisponível"));
    expect(await screen.findByRole("alert")).toHaveTextContent("painel indisponível");
    expect(screen.queryByText("Fila de revisão em dia")).not.toBeInTheDocument();
    expect(screen.queryByText("Atenção")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Revisar fila" })).not.toBeInTheDocument();
    expect(focusSection()).toHaveClass("admin-dashboard-focus--unavailable");
    expect(published).toHaveTextContent("4");
    expect(published).not.toHaveAttribute("aria-busy", "true");
  });

  it("falha da ingestão no refresh não confirma Em dia com o cache", async () => {
    let rejectIngest;
    loadAdminDashboardJobCounts.mockResolvedValue(clearCounts);
    countIngestionsNeedingAttention.mockResolvedValue(0);
    const view = renderHome("admin", 0);
    expect(await screen.findByText("Fila de revisão em dia")).toBeInTheDocument();

    countIngestionsNeedingAttention.mockImplementation(
      () => new Promise((_, reject) => { rejectIngest = reject; }),
    );
    view.rerender(homeTree("admin", 1));

    const ingestCard = screen.getByText("Ingestões pendentes").closest(".admin-dashboard-stat");
    expect(ingestCard).toHaveAttribute("aria-busy", "true");
    expect(ingestCard).toHaveTextContent("0");

    rejectIngest(new Error("contagem indisponível"));
    expect(await screen.findByRole("alert")).toHaveTextContent("contagem indisponível");
    expect(screen.queryByText("Fila de revisão em dia")).not.toBeInTheDocument();
    expect(screen.queryByText("Atenção")).not.toBeInTheDocument();
    expect(focusSection()).toHaveClass("admin-dashboard-focus--unavailable");
    expect(ingestCard).toHaveTextContent("0");
  });
});
