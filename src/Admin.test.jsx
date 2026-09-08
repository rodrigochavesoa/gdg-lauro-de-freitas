import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadCurationProfile = vi.hoisted(() => vi.fn(async () => null));
const loadAdminJobs = vi.hoisted(() => vi.fn(async () => []));

vi.mock("./features/curation/curation-api.js", () => ({
  loadCurationProfile: (...args) => loadCurationProfile(...args),
  signInCuration: vi.fn(),
}));

vi.mock("./lib/admin-api.js", () => ({
  createPendingJob: vi.fn(),
  loadAdminJobs: (...args) => loadAdminJobs(...args),
  loadCompanies: vi.fn(async () => []),
  updatePendingJob: vi.fn(),
}));

vi.mock("./features/curation/CurationQueue.jsx", () => ({
  CurationQueue: () => null,
}));

import { Admin } from "./Admin.jsx";

describe("Admin", () => {
  beforeEach(() => {
    loadCurationProfile.mockReset();
    loadCurationProfile.mockResolvedValue(null);
    loadAdminJobs.mockReset();
    loadAdminJobs.mockResolvedValue([]);
  });

  it("usa admin-auth-form compacto, sem job-form do CRUD", async () => {
    render(<Admin session={null} authReady />);
    expect(await screen.findByRole("heading", { name: "Entrar para curadoria ou admin" })).toBeInTheDocument();
    const form = document.querySelector("form.admin-auth-form");
    expect(form).toBeTruthy();
    expect(form).not.toHaveClass("job-form");
    expect(document.querySelector(".admin-side")).toBeNull();
    expect(document.querySelector(".admin-auth-shell")).toBeTruthy();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
  });

    it("área logada não renderiza sidebar nem card de perfil", async () => {
    loadCurationProfile.mockResolvedValue({
      id: "c1",
      role: "curator",
      full_name: "Cora Curadora",
      email: "curator-homolog@example.invalid",
    });
    render(<Admin session={{ user: { id: "c1" } }} authReady />);
    expect(await screen.findByRole("button", { name: "Curadoria" })).toBeInTheDocument();
    expect(document.querySelector(".admin-side")).toBeNull();
    expect(document.querySelector(".admin-user")).toBeNull();
    expect(screen.queryByText("Cora Curadora")).not.toBeInTheDocument();
    const tabs = document.querySelector(".admin-tabs");
    expect(tabs).toBeTruthy();
    expect(within(tabs).queryByRole("button", { name: "Publicar vaga" })).not.toBeInTheDocument();
  });

  it("admin troca Curadoria e Publicar vaga pelas tabs", async () => {
    loadCurationProfile.mockResolvedValue({
      id: "a1",
      role: "admin",
      full_name: "Ada Admin",
      email: "ada@example.invalid",
    });
    render(<Admin session={{ user: { id: "a1" } }} authReady />);
    expect(await screen.findByRole("button", { name: "Publicar vaga" })).toBeInTheDocument();
    expect(document.querySelector(".admin-side")).toBeNull();
    expect(screen.queryByText("Ada Admin")).not.toBeInTheDocument();
    const tabs = document.querySelector(".admin-tabs");
    expect(within(tabs).getByRole("button", { name: "Curadoria" })).toBeInTheDocument();
    expect(within(tabs).getByRole("button", { name: "Publicar vaga" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Publicar nova vaga" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cadastrar para curadoria" })).toBeInTheDocument();
    fireEvent.click(within(tabs).getByRole("button", { name: "Curadoria" }));
    expect(screen.queryByRole("heading", { name: "Publicar nova vaga" })).not.toBeInTheDocument();
    fireEvent.click(within(tabs).getByRole("button", { name: "Publicar vaga" }));
    expect(screen.getByRole("heading", { name: "Publicar nova vaga" })).toBeInTheDocument();
    expect(document.querySelector(".job-form .form-actions")).toBeTruthy();
  });

  it("lista pendentes e publicadas em seções separadas, com o form acima", async () => {
    loadCurationProfile.mockResolvedValue({
      id: "a1",
      role: "admin",
      full_name: "Ada Admin",
      email: "ada@example.invalid",
    });
    loadAdminJobs.mockResolvedValue([
      {
        id: "j1",
        title: "Pessoa Desenvolvedora Front-end",
        status: "approved",
        companies: { name: "Nuvem Lauro Demo" },
      },
      {
        id: "j2",
        title: "Pessoa Estagiária (rascunho)",
        status: "pending",
        companies: { name: "Nuvem Lauro Demo" },
      },
    ]);
    render(<Admin session={{ user: { id: "a1" } }} authReady />);
    expect(await screen.findByRole("heading", { name: "Aguardando curadoria" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Vagas pending e approved" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^pending$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^approved$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pending ·/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/approved ·/i)).not.toBeInTheDocument();

    const form = document.querySelector("form.job-form");
    const pendingSection = screen.getByRole("heading", { name: "Aguardando curadoria" }).closest(".admin-job-list");
    expect(form).toBeTruthy();
    expect(pendingSection).toBeTruthy();
    expect(form.compareDocumentPosition(pendingSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(within(pendingSection).getByRole("button", { name: /Pessoa Estagiária \(rascunho\)/ })).toBeInTheDocument();
    expect(within(pendingSection).getByText("Pendente")).toHaveClass("featured");
    expect(within(pendingSection).queryByText("Pessoa Desenvolvedora Front-end")).not.toBeInTheDocument();

    const publishedSection = document.querySelector("details.admin-job-list");
    expect(publishedSection).toBeTruthy();
    expect(publishedSection.open).toBe(false);
    expect(within(publishedSection).getByText("Vagas publicadas")).toBeInTheDocument();
    expect(within(publishedSection).getByText("Publicada")).toHaveClass("featured");
    expect(within(publishedSection).getByText("Pessoa Desenvolvedora Front-end")).toHaveClass("admin-job-list-title");
    expect(within(publishedSection).queryByRole("button", { name: /Pessoa Desenvolvedora Front-end/ })).not.toBeInTheDocument();
    expect(within(publishedSection).getByText("Edite via nova rodada na Curadoria.")).toBeInTheDocument();
  });
});
