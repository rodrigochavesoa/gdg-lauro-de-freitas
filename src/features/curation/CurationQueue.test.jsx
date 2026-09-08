import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadCurationQueue = vi.hoisted(() => vi.fn());

vi.mock("./curation-api.js", () => ({
  loadCurationQueue: (...args) => loadCurationQueue(...args),
  subscribeCurationJobs: () => () => {},
  submitCurationReview: vi.fn(),
  resubmitJobForCuration: vi.fn(),
  setJobCurationPriority: vi.fn(),
}));

import { CurationQueue } from "./CurationQueue.jsx";

const queuePayload = {
  queue: [
    {
      id: "job-1",
      title: "Pessoa Dev Front-end (fila)",
      priority: "urgent",
      needsModeration: false,
      curation_round: 1,
      description: "Vaga fictícia para curadoria.",
      stack: ["React"],
      level: "junior",
      work_model: "remote",
      companies: { name: "Nuvem Lauro Demo" },
    },
  ],
  rejected: [],
  reviews: [],
};

describe("CurationQueue", () => {
  beforeEach(() => {
    loadCurationQueue.mockReset();
    loadCurationQueue.mockResolvedValue(queuePayload);
  });

  it("mostra o loading existente e depois o conteúdo da fila", async () => {
    let resolveQueue;
    loadCurationQueue.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveQueue = resolve;
        }),
    );

    render(
      <CurationQueue
        includeRejected={false}
        profile={{ role: "curator", full_name: "Curador Homolog", email: "curator-homolog@example.invalid" }}
      />,
    );

    expect(screen.getByText("Carregando fila de curadoria…")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pessoa Dev Front-end (fila)" })).not.toBeInTheDocument();

    resolveQueue(queuePayload);

    expect(await screen.findByRole("heading", { name: "Pessoa Dev Front-end (fila)" })).toBeInTheDocument();
    expect(screen.queryByText("Carregando fila de curadoria…")).not.toBeInTheDocument();
    expect(loadCurationQueue).toHaveBeenCalledWith({ includeRejected: false });
  });

  it("lista a fila e a rubrica sem chamar Supabase no JSX", async () => {
    render(
      <CurationQueue
        includeRejected={false}
        profile={{ role: "curator", full_name: "Curador Homolog", email: "curator-homolog@example.invalid" }}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Fila de revisão" })).toBeInTheDocument();
    expect(document.querySelector(".admin-user")).toBeNull();
    expect(screen.queryByText("Curador Homolog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sair/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pessoa Dev Front-end (fila)" })).toBeInTheDocument();
    expect(screen.getByText("Empresa e oportunidade identificáveis")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Enviar parecer/i })).toBeInTheDocument();
  });
});
