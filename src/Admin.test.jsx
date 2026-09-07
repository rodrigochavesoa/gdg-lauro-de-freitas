import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./features/curation/curation-api.js", () => ({
  loadCurationProfile: async () => null,
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

describe("Admin staff login", () => {
  it("usa admin-auth-form compacto, sem job-form do CRUD", async () => {
    render(<Admin session={null} authReady />);
    expect(await screen.findByRole("heading", { name: "Entrar para curadoria ou admin" })).toBeInTheDocument();
    const form = document.querySelector("form.admin-auth-form");
    expect(form).toBeTruthy();
    expect(form).not.toHaveClass("job-form");
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
  });
});
