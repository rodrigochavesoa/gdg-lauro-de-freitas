import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadAdminJob = vi.hoisted(() => vi.fn());
const deleteAdminJob = vi.hoisted(() => vi.fn());

vi.mock("../../lib/admin-api.js", async () => {
  const actual = await vi.importActual("../../lib/admin-api.js");
  return { ...actual, loadAdminJob: (...args) => loadAdminJob(...args) };
});

import { AdminJobDetailRoute } from "./AdminJobDetailRoute.jsx";
vi.mock("./admin-jobs-api.js", async () => {
  const actual = await vi.importActual("./admin-jobs-api.js");
  return { ...actual, deleteAdminJob: (...args) => deleteAdminJob(...args) };
});

function renderDetail({ role = "admin", back = "/admin/vagas" } = {}) {
  return render(
    <MemoryRouter initialEntries={[`/admin/vagas/job-1?back=${encodeURIComponent(back)}`]}>
      <Routes>
        <Route path="/admin/vagas" element={<Outlet context={{ profile: { role } }} />}>
          <Route index element={<p>Lista de vagas</p>} />
          <Route path=":id" element={<AdminJobDetailRoute />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminJobDetailRoute", () => {
  beforeEach(() => {
    loadAdminJob.mockReset();
    deleteAdminJob.mockReset();
    loadAdminJob.mockResolvedValue({
      id: "job-1",
      title: "Vaga de teste",
      status: "approved",
      description: "Descrição de teste",
      job_curation_reviews: [],
    });
  });

  it("permite repetir o carregamento após falha de rede", async () => {
    loadAdminJob
      .mockRejectedValueOnce(new Error("Falha transitória."))
      .mockResolvedValueOnce({
        id: "job-1",
        title: "Vaga recuperada",
        status: "pending",
        description: "Descrição de teste",
        job_curation_reviews: [],
      });

    renderDetail();

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível completar a operação.");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("heading", { name: "Vaga recuperada" })).toBeInTheDocument();
    expect(loadAdminJob).toHaveBeenCalledTimes(2);
  });

  it.each(["curator", "moderator"])("mantém a exclusão escondida para %s", async (role) => {
    renderDetail({ role });
    expect(await screen.findByRole("heading", { name: "Vaga de teste" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir vaga" })).not.toBeInTheDocument();
  });

  it("exige digitação exata, permite cancelar sem excluir e confirma a exclusão", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "Vaga de teste" });

    const pageTitle = document.querySelector(".admin-title");
    expect(within(pageTitle).getByRole("link", { name: "Voltar às vagas" })).toBeInTheDocument();
    expect(document.querySelector(".admin-job-detail-actions")).not.toContainElement(
      screen.getByRole("link", { name: "Voltar às vagas" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Excluir vaga" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("candidaturas");
    expect(dialog).toHaveTextContent("pareceres");
    const confirm = screen.getByRole("button", { name: "Confirmar exclusão" });
    expect(confirm).toBeDisabled();
    const actions = document.querySelector(".admin-job-delete-actions");
    expect(actions).toHaveClass("admin-job-delete-actions");
    expect(within(actions).getByRole("button", { name: "Cancelar" })).toHaveClass("admin-job-delete-cancel");
    expect(confirm).toHaveClass("admin-job-delete-confirm");
    fireEvent.change(screen.getByLabelText(/digite excluir/i), { target: { value: "EXCLUIR " } });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/digite excluir/i), { target: { value: "EXCLUIR" } });
    expect(confirm).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(deleteAdminJob).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Excluir vaga" }));
    fireEvent.change(screen.getByLabelText(/digite excluir/i), { target: { value: "EXCLUIR" } });
    deleteAdminJob.mockResolvedValue({ id: "job-1" });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
    expect(deleteAdminJob).toHaveBeenCalledWith("job-1");
    expect(await screen.findByText("Lista de vagas")).toBeInTheDocument();
  });

  it("apresenta erro recuperável sem sair do detalhe", async () => {
    deleteAdminJob.mockRejectedValue(new Error("AAL2 required"));
    renderDetail();
    await screen.findByRole("heading", { name: "Vaga de teste" });
    fireEvent.click(screen.getByRole("button", { name: "Excluir vaga" }));
    fireEvent.change(screen.getByLabelText(/digite excluir/i), { target: { value: "EXCLUIR" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("segundo fator");
    expect(screen.getByRole("heading", { name: "Vaga de teste" })).toBeInTheDocument();
  });
});
