import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./curation-api.js", () => ({
  loadCurationQueue: async () => ({
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
  }),
  subscribeCurationJobs: () => () => {},
  submitCurationReview: vi.fn(),
  resubmitJobForCuration: vi.fn(),
  setJobCurationPriority: vi.fn(),
}));

import { CurationQueue } from "./CurationQueue.jsx";

describe("CurationQueue", () => {
  it("lista a fila e a rubrica sem chamar Supabase no JSX", async () => {
    render(
      <CurationQueue
        profile={{ role: "curator", full_name: "Curador Homolog", email: "curator-homolog@example.invalid" }}
        onLogout={() => {}}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Fila de revisão" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pessoa Dev Front-end (fila)" })).toBeInTheDocument();
    expect(screen.getByText("Empresa e oportunidade identificáveis")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Enviar parecer/i })).toBeInTheDocument();
  });
});
