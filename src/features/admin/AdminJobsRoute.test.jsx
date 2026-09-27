import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadAdminJobPage = vi.hoisted(() => vi.fn());

vi.mock("./admin-jobs-api.js", async () => {
  const actual = await vi.importActual("./admin-jobs-api.js");
  return {
    ...actual,
    loadAdminJobPage: (...args) => loadAdminJobPage(...args),
  };
});

import { AdminJobsRoute } from "./AdminJobsRoute.jsx";

const emptyPage = { items: [], total: 0, page: 1, pageSize: 24, hasNext: false };

function renderRoute(initial = "/admin/vagas") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <AdminJobsRoute />
    </MemoryRouter>,
  );
}

describe("AdminJobsRoute", () => {
  beforeEach(() => {
    loadAdminJobPage.mockReset();
    loadAdminJobPage.mockResolvedValue(emptyPage);
  });

  it("usa shimmer do painel na carga inicial sem job-card--skeleton", async () => {
    let resolvePage;
    loadAdminJobPage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePage = resolve;
        }),
    );

    renderRoute();
    expect(screen.getByRole("heading", { name: "Gestão de vagas" })).toBeInTheDocument();
    expect(document.querySelector(".admin-ingest__loading")).toBeTruthy();
    expect(document.querySelector(".admin-jobs-count-skeleton")).toBeTruthy();
    expect(document.querySelector(".job-card--skeleton")).toBeNull();
    expect(screen.queryByText("Carregando…")).not.toBeInTheDocument();
    expect(screen.getByText("Carregando vagas da área administrativa…").className).toContain("sr-only");

    resolvePage(emptyPage);
    expect(await screen.findByText(/Nenhuma vaga/)).toBeInTheDocument();
    expect(document.querySelector(".admin-ingest__loading")).toBeNull();
  });
});
