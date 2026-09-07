import React from "react";
import { render, screen } from "@testing-library/react";
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

  it("sidebar logada não duplica a marca GDGJobs", async () => {
    loadCurationProfile.mockResolvedValue({
      id: "c1",
      role: "curator",
      full_name: "Cora Curadora",
      email: "curator-homolog@example.invalid",
    });
    render(<Admin session={{ user: { id: "c1" } }} authReady />);
    expect(await screen.findByText("Cora Curadora")).toBeInTheDocument();
    expect(document.querySelector(".admin-side")).toBeTruthy();
    expect(document.querySelector(".admin-side .brand")).toBeNull();
    expect(document.querySelector(".admin-side .admin-user")).toBeTruthy();
    expect(screen.getByText("Cora Curadora")).toBeInTheDocument();
  });
});
