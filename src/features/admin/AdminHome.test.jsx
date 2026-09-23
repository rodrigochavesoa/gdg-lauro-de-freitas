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

function renderHome(role) {
  function Shell() {
    return <Outlet context={{ profile: { role } }} />;
  }
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<Shell />}>
          <Route index element={<AdminHome />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminHome", () => {
  beforeEach(() => {
    loadAdminDashboardJobCounts.mockReset();
    countIngestionsNeedingAttention.mockReset();
    loadAdminDashboardJobCounts.mockResolvedValue(jobCounts);
    countIngestionsNeedingAttention.mockResolvedValue(0);
  });

  it("mostra as contagens de vagas sem esperar a contagem de ingestão", async () => {
    let resolveIngest;
    countIngestionsNeedingAttention.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveIngest = resolve;
        }),
    );
    renderHome("admin");
    expect(screen.getByText("Carregando indicadores…")).toBeInTheDocument();
    expect(await screen.findByText("2 vagas aguardam revisão")).toBeInTheDocument();
    expect(screen.queryByText("Carregando indicadores…")).not.toBeInTheDocument();
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
    expect(await screen.findByRole("alert")).toHaveTextContent("painel indisponível");
    expect(screen.queryByText("Fila de revisão em dia")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(loadAdminDashboardJobCounts).toHaveBeenCalledTimes(2));
  });
});
