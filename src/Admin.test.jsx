import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadCurationProfile = vi.hoisted(() => vi.fn(async () => null));

vi.mock("./features/curation/curation-api.js", () => ({
  loadCurationProfile: (...args) => loadCurationProfile(...args),
  signInCuration: vi.fn(),
}));

vi.mock("./lib/admin-api.js", () => ({
  createPendingJob: vi.fn(),
  loadAdminJobs: vi.fn(async () => []),
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
});
