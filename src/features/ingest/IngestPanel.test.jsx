import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadJobIngestions = vi.hoisted(() => vi.fn(async () => ({ items: [], hasNext: false, page: 1, pageSize: 24 })));
const loadJobIngestionDetail = vi.hoisted(() => vi.fn(async () => null));
const processJobIngestion = vi.hoisted(() => vi.fn());

vi.mock("./ingest-api.js", async () => {
  const actual = await vi.importActual("./ingest-api.js");
  return {
    ...actual,
    loadJobIngestions: (...args) => loadJobIngestions(...args),
    loadJobIngestionDetail: (...args) => loadJobIngestionDetail(...args),
    processJobIngestion: (...args) => processJobIngestion(...args),
  };
});

import { IngestPanel } from "./IngestPanel.jsx";

const emptyPage = { items: [], hasNext: false, page: 1, pageSize: 24 };

describe("IngestPanel", () => {
  beforeEach(() => {
    loadJobIngestions.mockReset();
    loadJobIngestions.mockResolvedValue(emptyPage);
    loadJobIngestionDetail.mockReset();
    loadJobIngestionDetail.mockResolvedValue(null);
    processJobIngestion.mockReset();
  });

  it("mostra loading e estado vazio", async () => {
    let resolveRows;
    loadJobIngestions.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRows = resolve;
        }),
    );
    render(<IngestPanel />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando ingestões…");
    resolveRows(emptyPage);
    expect(await screen.findByText("Nenhuma ingestão registrada.")).toBeInTheDocument();
  });

  it("mostra erro da listagem", async () => {
    loadJobIngestions.mockRejectedValue(new Error("Falha fictícia de leitura."));
    render(<IngestPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha fictícia de leitura.");
  });

  it("ingere fixture e permite reprocessar", async () => {
    loadJobIngestions
      .mockResolvedValueOnce(emptyPage)
      .mockResolvedValue({
        items: [
          {
            id: "ing-1",
            source_kind: "manual_fixture",
            normalized_locator: "fixture:homolog-acme-frontend",
            payload_title: "Pessoa Dev Front-end (fixture homolog)",
            latest_outcome: "materialized",
            jobs: { id: "job-1", title: "Pessoa Dev Front-end (fixture homolog)", status: "pending" },
          },
        ],
        hasNext: false,
        page: 1,
        pageSize: 24,
      });
    loadJobIngestionDetail.mockResolvedValue({
      id: "ing-1",
      source_kind: "manual_fixture",
      normalized_locator: "fixture:homolog-acme-frontend",
      canonical_payload: { title: "Pessoa Dev Front-end (fixture homolog)", company_name: "Empresa Fictícia Lab" },
      jobs: { id: "job-1", title: "Pessoa Dev Front-end (fixture homolog)", status: "pending" },
      job_ingestion_attempts: [
        { id: "a1", outcome: "materialized", created_at: "2026-09-20T12:00:00.000Z" },
      ],
    });
    processJobIngestion.mockResolvedValue({
      ingestion: { id: "ing-1" },
      job: { id: "job-1", title: "Pessoa Dev Front-end (fixture homolog)", status: "pending" },
      outcome: "materialized",
    });
    render(<IngestPanel />);
    expect(await screen.findByText("Nenhuma ingestão registrada.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Localizador")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nova fixture" }));
    expect(screen.getByLabelText("Localizador")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ingerir fixture (pendente)" }));
    await waitFor(() => expect(processJobIngestion).toHaveBeenCalled());
    expect(screen.getByText(/Vaga pendente de curadoria · Pessoa Dev Front-end/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver detalhes" }));
    expect(await screen.findByText("pending")).toBeInTheDocument();
    expect(screen.getByText(/Localizador:/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Reprocessar" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Reprocessar" }));
    await waitFor(() => expect(processJobIngestion).toHaveBeenCalledTimes(2));
  });
});
