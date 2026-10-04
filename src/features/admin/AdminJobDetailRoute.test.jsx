import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadAdminJob = vi.hoisted(() => vi.fn());

vi.mock("../../lib/admin-api.js", async () => {
  const actual = await vi.importActual("../../lib/admin-api.js");
  return { ...actual, loadAdminJob: (...args) => loadAdminJob(...args) };
});

import { AdminJobDetailRoute } from "./AdminJobDetailRoute.jsx";

describe("AdminJobDetailRoute", () => {
  beforeEach(() => {
    loadAdminJob.mockReset();
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

    render(
      <MemoryRouter initialEntries={["/admin/vagas/job-1"]}>
        <Routes>
          <Route path="/admin/vagas/:id" element={<AdminJobDetailRoute />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível completar a operação.");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("heading", { name: "Vaga recuperada" })).toBeInTheDocument();
    expect(loadAdminJob).toHaveBeenCalledTimes(2);
  });
});
