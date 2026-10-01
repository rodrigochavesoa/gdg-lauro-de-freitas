import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadAdminDashboardSummary = vi.hoisted(() => vi.fn());

vi.mock("./admin-dashboard-api.js", () => ({
  loadAdminDashboardSummary: (...args) => loadAdminDashboardSummary(...args),
}));

import { AdminHome } from "./AdminHome.jsx";

const jobCounts = {
  pendingCuration: 2,
  approved: 1,
  rejectedJobs: 0,
  rejectedQueue: 0,
  pendingJobs: 2,
  ingestAttention: 0,
  ingestAvailable: true,
};

const clearCounts = {
  pendingCuration: 0,
  approved: 4,
  rejectedJobs: 0,
  rejectedQueue: 0,
  pendingJobs: 0,
  ingestAttention: 0,
  ingestAvailable: true,
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
    loadAdminDashboardSummary.mockReset();
    loadAdminDashboardSummary.mockResolvedValue(jobCounts);
  });

  it("mostra a estrutura antes da RPC e não trata pendente como zero", async () => {
    let resolveSummary;
    loadAdminDashboardSummary.mockImplementation(
      () => new Promise((resolve) => { resolveSummary = resolve; }),
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
    expect(loadAdminDashboardSummary).toHaveBeenCalledTimes(1);

    resolveSummary({ ...jobCounts, ingestAttention: 3 });
    expect(await screen.findByRole("heading", { name: "Curadoria" })).toBeInTheDocument();
    expect(screen.getByText("2 vagas aguardam revisão")).toBeInTheDocument();
    expect(screen.getByText("Atenção")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revisar fila" })).toHaveAttribute("href", "/admin/curadoria");
    expect(focusSection()).toHaveClass("admin-dashboard-focus--attention");
    expect(await screen.findByRole("link", { name: "Ver ingestões (3)" })).toBeInTheDocument();
    expect(document.querySelector(".admin-dashboard-stat--skeleton")).toBeNull();
    expect(document.querySelector(".admin-dashboard-stat--ingest-attention")).toHaveTextContent("3");
    expect(screen.queryByText("Fila de revisão em dia")).not.toBeInTheDocument();
    expect(loadAdminDashboardSummary).toHaveBeenCalledTimes(1);
  });

  it("com pendência de curadoria destaca a ação de revisar a fila", async () => {
    loadAdminDashboardSummary.mockResolvedValue({ ...jobCounts, ingestAttention: 1 });
    renderHome("admin");
    expect(await screen.findByRole("heading", { name: "Curadoria" })).toBeInTheDocument();
    expect(screen.getByText("2 vagas aguardam revisão")).toBeInTheDocument();
    expect(screen.getByText("Atenção")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revisar fila" })).toHaveClass("primary");
    expect(await screen.findByRole("link", { name: "Ver ingestões (1)" })).toHaveAttribute("href", "/admin/ingestao");
    expect(screen.queryByText("Fila de revisão em dia")).not.toBeInTheDocument();
    expect(document.querySelector(".admin-dashboard-stat--ingest-attention")).toHaveTextContent("Ingestões pendentes");
  });

  it("indicador de situação usa dois pontos e não repete Visão geral no foco", async () => {
    loadAdminDashboardSummary.mockResolvedValue({ ...jobCounts, ingestAttention: 1 });
    renderHome("admin");
    await screen.findByText("Atenção");
    const steps = document.querySelector(".admin-dashboard-steps");
    expect(steps).toBeTruthy();
    expect(steps.querySelectorAll(".admin-dashboard-steps__item")).toHaveLength(2);
    expect(steps.textContent).not.toMatch(/Visão geral/);
    expect(screen.getByRole("heading", { name: "Visão geral" })).toBeInTheDocument();
  });

  it("sem pendência mostra estado positivo e não mantém o alerta laranja", async () => {
    let resolveSummary;
    loadAdminDashboardSummary.mockImplementation(
      () => new Promise((resolve) => { resolveSummary = resolve; }),
    );
    renderHome("admin");
    expect(screen.getByRole("heading", { name: "Painel" })).toBeInTheDocument();
    expect(screen.queryByText("Fila de revisão em dia")).not.toBeInTheDocument();
    expect(focusSection()).toHaveAttribute("aria-busy", "true");

    resolveSummary(clearCounts);
    expect(await screen.findByRole("heading", { name: "Em dia" })).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Fila de revisão em dia")).toBeInTheDocument();
    expect(screen.queryByText("Atenção")).not.toBeInTheDocument();
    expect(document.querySelector(".admin-dashboard-steps--clear .admin-dashboard-steps__label")).toHaveTextContent("Em dia");
    expect(screen.queryByRole("link", { name: "Revisar fila" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ver ingestões/ })).not.toBeInTheDocument();
    expect(focusSection()).toHaveClass("admin-dashboard-focus--clear");
    expect(focusSection()).not.toHaveClass("admin-dashboard-focus--attention");
    expect(document.querySelector(".admin-dashboard-stat--ingest-attention")).toHaveTextContent("0");
  });

  it("prioriza ingestão quando a curadoria está em dia e há ingestões pendentes", async () => {
    loadAdminDashboardSummary.mockResolvedValue({ ...clearCounts, ingestAttention: 3 });
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
    loadAdminDashboardSummary.mockResolvedValue({
      ...clearCounts,
      pendingJobs: 4,
    });
    renderHome("admin");
    expect(await screen.findByRole("heading", { name: "Vagas" })).toBeInTheDocument();
    expect(screen.getByText("4 vagas pendentes")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver vagas (4 pendentes)" })).toHaveAttribute("href", "/admin/vagas");
    expect(screen.getByText("Atenção")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Revisar fila" })).not.toBeInTheDocument();
    expect(screen.queryByText("Fila de revisão em dia")).not.toBeInTheDocument();
  });

  it("curator usa uma RPC e não mostra cards de ingestão", async () => {
    renderHome("curator");
    expect(await screen.findByText("2 vagas aguardam revisão")).toBeInTheDocument();
    expect(loadAdminDashboardSummary).toHaveBeenCalledTimes(1);
    expect(loadAdminDashboardSummary).toHaveBeenCalledWith({ isAdmin: false });
    expect(screen.queryByText("Ingestões pendentes")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revisar fila" })).toBeInTheDocument();
  });

  it("curator sem fila mostra o estado positivo sem cards de admin", async () => {
    loadAdminDashboardSummary.mockResolvedValue({
      pendingCuration: 0,
      approved: 0,
      rejectedJobs: 0,
      rejectedQueue: 0,
      pendingJobs: 0,
      ingestAttention: 0,
    });
    renderHome("curator");
    expect(await screen.findByText("Fila de revisão em dia")).toBeInTheDocument();
    expect(loadAdminDashboardSummary).toHaveBeenCalledWith({ isAdmin: false });
    expect(screen.queryByText("Atenção")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Revisar fila" })).not.toBeInTheDocument();
    expect(screen.queryByText("Ingestões pendentes")).not.toBeInTheDocument();
  });

  it("moderator não vê cards de admin", async () => {
    renderHome("moderator");
    expect(await screen.findByText("2 vagas aguardam revisão")).toBeInTheDocument();
    expect(loadAdminDashboardSummary).toHaveBeenCalledWith({ isAdmin: false });
    expect(screen.queryByText("Ingestões pendentes")).not.toBeInTheDocument();
    expect(screen.queryByText("Publicadas")).not.toBeInTheDocument();
    expect(screen.queryByText("Rejeitadas")).not.toBeInTheDocument();
    expect(screen.queryByText("Na fila")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Visão geral" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revisar fila" })).toHaveAttribute("href", "/admin/curadoria");
  });

  it("moderator sem fila mostra Em dia", async () => {
    loadAdminDashboardSummary.mockResolvedValue({
      pendingCuration: 0,
      approved: 0,
      rejectedJobs: 0,
      rejectedQueue: 0,
      pendingJobs: 0,
      ingestAttention: 0,
    });
    renderHome("moderator");
    expect(await screen.findByText("Fila de revisão em dia")).toBeInTheDocument();
    expect(screen.queryByText("Ingestões pendentes")).not.toBeInTheDocument();
    expect(screen.queryByText("Publicadas")).not.toBeInTheDocument();
    expect(screen.queryByText("Atenção")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Revisar fila" })).not.toBeInTheDocument();
  });

  it("ingestão indisponível não aparece como zero e preserva as vagas", async () => {
    loadAdminDashboardSummary.mockResolvedValue({
      ...clearCounts,
      ingestAttention: null,
      ingestAvailable: false,
    });
    renderHome("admin");
    expect(await screen.findByText("Indisponível")).toBeInTheDocument();
    const ingestCard = screen.getByText("Ingestões pendentes").closest(".admin-dashboard-stat");
    const published = screen.getByText("Publicadas").closest(".admin-dashboard-stat");
    expect(ingestCard).toHaveTextContent("Indisponível");
    expect(ingestCard).not.toHaveTextContent("0");
    expect(published).toHaveTextContent("4");
    expect(screen.queryByText("Fila de revisão em dia")).not.toBeInTheDocument();
    expect(focusSection()).toHaveClass("admin-dashboard-focus--unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(loadAdminDashboardSummary).toHaveBeenCalledTimes(2));
  });

  it("falha da RPC não publica zeros", async () => {
    loadAdminDashboardSummary.mockRejectedValue(new Error("painel indisponível"));
    renderHome("admin");
    expect(screen.getByRole("heading", { name: "Painel" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("painel indisponível");
    expect(screen.queryByText("Fila de revisão em dia")).not.toBeInTheDocument();
    expect(screen.queryByText("0 vagas aguardam revisão")).not.toBeInTheDocument();
    expect(screen.queryByText("Atenção")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Revisar fila" })).not.toBeInTheDocument();
    expect(document.querySelector(".admin-dashboard-stat--skeleton")).toBeTruthy();
    expect(focusSection()).toHaveClass("admin-dashboard-focus--unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(loadAdminDashboardSummary).toHaveBeenCalledTimes(2));
  });

  it("recarregar preserva o último valor e marca aria-busy", async () => {
    let resolveReload;
    const view = renderHome("admin", 0);
    expect(await screen.findByText("2 vagas aguardam revisão")).toBeInTheDocument();

    loadAdminDashboardSummary.mockImplementation(
      () => new Promise((resolve) => { resolveReload = resolve; }),
    );
    view.rerender(homeTree("admin", 1));

    expect(screen.getByText("2 vagas aguardam revisão")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Curadoria" }).closest("section")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Fila de revisão em dia")).not.toBeInTheDocument();
    expect(screen.queryByText("0 vagas aguardam revisão")).not.toBeInTheDocument();

    resolveReload({ ...jobCounts, pendingCuration: 4, pendingJobs: 4, ingestAttention: 0 });
    expect(await screen.findByText("4 vagas aguardam revisão")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Curadoria" }).closest("section")).not.toHaveAttribute("aria-busy", "true");
  });

  it("falha no refresh não confirma Em dia com o valor em cache", async () => {
    let rejectSummary;
    loadAdminDashboardSummary.mockResolvedValue(clearCounts);
    const view = renderHome("admin", 0);
    expect(await screen.findByText("Fila de revisão em dia")).toBeInTheDocument();

    loadAdminDashboardSummary.mockImplementation(
      () => new Promise((_, reject) => { rejectSummary = reject; }),
    );
    view.rerender(homeTree("admin", 1));

    const published = screen.getByText("Publicadas").closest(".admin-dashboard-stat");
    const ingestCard = screen.getByText("Ingestões pendentes").closest(".admin-dashboard-stat");
    expect(published).toHaveAttribute("aria-busy", "true");
    expect(published).toHaveTextContent("4");
    expect(ingestCard).toHaveTextContent("0");
    expect(screen.getByText("Fila de revisão em dia")).toBeInTheDocument();

    rejectSummary(new Error("painel indisponível"));
    expect(await screen.findByRole("alert")).toHaveTextContent("painel indisponível");
    expect(screen.queryByText("Fila de revisão em dia")).not.toBeInTheDocument();
    expect(screen.queryByText("Atenção")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Revisar fila" })).not.toBeInTheDocument();
    expect(focusSection()).toHaveClass("admin-dashboard-focus--unavailable");
    expect(published).toHaveTextContent("4");
    expect(ingestCard).toHaveTextContent("0");
    expect(published).not.toHaveAttribute("aria-busy", "true");
  });
});
