import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const loadCompanies = vi.hoisted(() => vi.fn());
const loadAdminJob = vi.hoisted(() => vi.fn());

vi.mock("../../lib/admin-api.js", () => ({
  COMPANY_LIST_LIMIT: 20,
  COMPANY_SEARCH_MIN_LENGTH: 2,
  COMPANY_SEARCH_MAX_LENGTH: 100,
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

  it("não carrega o diretório inicialmente e limita resultados da busca", async () => {
    renderForm();
    expect(loadCompanies).not.toHaveBeenCalled();

    loadCompanies.mockResolvedValueOnce({
      companies: [{ id: "c-late", name: "Zeta Lab" }],
      truncated: true,
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Buscar empresa cadastrada" }), { target: { value: "Zeta" } });

    const option = await screen.findByRole("option", { name: "Zeta Lab" });
    expect(option).toBeInTheDocument();
    expect(loadCompanies).toHaveBeenLastCalledWith({ query: "Zeta" });
    expect(screen.getByRole("status")).toHaveTextContent("Exibindo até 20 resultados. Refine a busca para localizar outras empresas.");
    fireEvent.click(option);
    expect(screen.getByRole("combobox", { name: "Buscar empresa cadastrada" })).toHaveValue("Zeta Lab");
    expect(screen.getByText("Empresa selecionada para esta vaga")).toBeInTheDocument();
  });

  it("exibe a empresa vinculada ao rascunho sem carregar a lista", async () => {
    loadAdminJob.mockResolvedValue({
      id: "job-1",
      status: "pending",
      title: "Pessoa Dev",
      company_id: "c-late",
      companies: { name: "Fora do corte" },
      description: "Vaga fictícia.",
      level: "mid",
      work_model: "remote",
      stack: [],
    });

    renderForm("/admin/vagas/nova?editar=job-1");

    expect(await screen.findByText("Empresa selecionada para esta vaga")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Buscar empresa cadastrada" })).toHaveValue("Fora do corte");
    expect(loadCompanies).not.toHaveBeenCalled();
  });

  it("separa falha de busca de uma busca sem resultado e permite retry", async () => {
    loadCompanies.mockRejectedValueOnce(new Error("empresas indisponíveis"));
    renderForm();
    fireEvent.change(screen.getByRole("combobox", { name: "Buscar empresa cadastrada" }), { target: { value: "Inexistente" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível buscar empresas agora. Tente novamente.");
    loadCompanies.mockResolvedValue({ companies: [], truncated: false });
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Nenhuma empresa encontrada para esta busca.");
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("não oferece formulário de criação quando a carga de edição falha e permite retry", async () => {
    loadAdminJob
      .mockRejectedValueOnce(new Error("Falha ao carregar rascunho."))
      .mockResolvedValueOnce({
        id: "job-2",
        status: "pending",
        title: "Rascunho recuperado",
        company_id: "c2",
        description: "Descrição fictícia.",
        level: "mid",
        work_model: "remote",
        stack: [],
      });

    renderForm("/admin/vagas/nova?editar=job-2");
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar rascunho.");
    expect(screen.queryByRole("button", { name: "Enviar à curadoria" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByLabelText("Título da vaga")).toHaveValue("Rascunho recuperado");
    expect(loadAdminJob).toHaveBeenCalledTimes(2);
  });

  it("não mostra tipo de contrato porque o schema não persiste o campo", async () => {
    renderForm();
    expect(await screen.findByLabelText("Título da vaga")).toBeInTheDocument();
    expect(screen.queryByLabelText("Tipo de contrato")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Tipo de contrato" })).not.toBeInTheDocument();
  });
});
