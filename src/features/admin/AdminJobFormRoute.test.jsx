import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const loadCompanies = vi.hoisted(() => vi.fn());
const loadAdminJob = vi.hoisted(() => vi.fn());

vi.mock("../../lib/admin-api.js", () => ({
  loadCompanies: (...args) => loadCompanies(...args),
  loadAdminJob: (...args) => loadAdminJob(...args),
  createPendingJob: vi.fn(),
  updatePendingJob: vi.fn(),
  validateAdminJob: () => [],
}));

import { AdminJobFormRoute } from "./AdminJobFormRoute.jsx";

function renderForm(path = "/admin/vagas/nova") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AdminJobFormRoute />
    </MemoryRouter>,
  );
}

describe("AdminJobFormRoute empresas", () => {
  beforeEach(() => {
    loadCompanies.mockReset();
    loadAdminJob.mockReset();
  });

  it("avisa que a página está incompleta e busca pelo nome", async () => {
    loadCompanies.mockResolvedValue({
      companies: [{ id: "c1", name: "Nuvem" }],
      truncated: true,
    });

    renderForm();
    expect(await screen.findByRole("status")).toHaveTextContent("Há mais empresas. Refine a busca para ver o restante.");

    loadCompanies.mockResolvedValueOnce({
      companies: [{ id: "c-late", name: "Zeta Lab" }],
      truncated: false,
    });
    fireEvent.change(screen.getByLabelText("Buscar empresa"), { target: { value: "Zeta" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByRole("option", { name: "Zeta Lab" })).toBeInTheDocument();
    expect(loadCompanies).toHaveBeenLastCalledWith({ query: "Zeta", includeId: "" });
    expect(screen.queryByText("Há mais empresas. Refine a busca para ver o restante.")).not.toBeInTheDocument();
  });

  it("mantém a empresa da vaga quando ela não vem na página", async () => {
    loadCompanies.mockImplementation(async ({ includeId } = {}) => ({
      companies: includeId
        ? [{ id: includeId, name: "Fora do corte" }, { id: "c1", name: "Nuvem" }]
        : [{ id: "c1", name: "Nuvem" }],
      truncated: true,
    }));
    loadAdminJob.mockResolvedValue({
      id: "job-1",
      status: "pending",
      title: "Pessoa Dev",
      company_id: "c-late",
      description: "Vaga fictícia.",
      level: "mid",
      work_model: "remote",
      stack: [],
    });

    renderForm("/admin/vagas/nova?editar=job-1");

    expect(await screen.findByRole("option", { name: "Fora do corte" })).toBeInTheDocument();
    expect(screen.getByLabelText("Empresa")).toHaveValue("c-late");
  });

  it("separa falha de carregamento de busca sem resultado", async () => {
    loadCompanies.mockRejectedValueOnce(new Error("empresas indisponíveis"));
    renderForm();
    expect(await screen.findByRole("alert")).toHaveTextContent("empresas indisponíveis");

    loadCompanies.mockResolvedValue({ companies: [], truncated: false });
    fireEvent.change(screen.getByLabelText("Buscar empresa"), { target: { value: "Inexistente" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Nenhuma empresa encontrada para esta busca.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
