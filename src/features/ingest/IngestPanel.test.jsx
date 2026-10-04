import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    expect(screen.getByRole("status", { hidden: true })).toHaveTextContent("Carregando ingestões…");
    expect(document.querySelector(".admin-ingest__loading")).toBeTruthy();
    expect(screen.getByText("Carregando ingestões…").className).toContain("sr-only");
    resolveRows(emptyPage);
    expect(await screen.findByText("Nenhuma ingestão registrada.")).toBeInTheDocument();
  });

  it("mostra erro da listagem", async () => {
    loadJobIngestions.mockRejectedValue(new Error("Falha fictícia de leitura."));
    render(<IngestPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha fictícia de leitura.");
  });

  it("busca e filtra localmente por status e fonte, sem refetch ao digitar", async () => {
    loadJobIngestions.mockResolvedValue({
      items: [
        {
          id: "ing-manual",
          source_kind: "manual_fixture",
          normalized_locator: "fixture:front-end",
          payload_title: "Pessoa Desenvolvedora Front-end",
          latest_outcome: "materialized",
        },
        {
          id: "ing-replay",
          source_kind: "staff_replay",
          normalized_locator: "fixture:back-end",
          payload_title: "Pessoa Desenvolvedora Back-end",
          latest_outcome: "failed",
        },
      ],
      hasNext: false,
      page: 1,
      pageSize: 24,
    });
    render(<IngestPanel />);
    expect(await screen.findByText("Pessoa Desenvolvedora Front-end")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Título, localizador ou fonte" }), { target: { value: "back-end" } });
    expect(screen.getByText("Pessoa Desenvolvedora Front-end")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("search", { name: "Buscar ingestões" })).getByRole("button", { name: "Buscar" }));
    expect(await screen.findByText("Pessoa Desenvolvedora Back-end")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Pessoa Desenvolvedora Front-end")).not.toBeInTheDocument());
    expect(loadJobIngestions).toHaveBeenCalledTimes(1);
    fireEvent.change(document.querySelector("#ingest-status-filter-desktop"), { target: { value: "materialized" } });
    expect(screen.getByRole("status")).toHaveTextContent("Nenhuma ingestão corresponde à busca e aos filtros.");
    fireEvent.click(screen.getByRole("button", { name: "Limpar busca e filtros" }));
    expect(await screen.findByText("Pessoa Desenvolvedora Front-end")).toBeInTheDocument();
    fireEvent.change(document.querySelector("#ingest-source-filter-desktop"), { target: { value: "staff_replay" } });
    await waitFor(() => expect(screen.queryByText("Pessoa Desenvolvedora Front-end")).not.toBeInTheDocument());
    expect(screen.getByText("Pessoa Desenvolvedora Back-end")).toBeInTheDocument();
    expect(loadJobIngestions).toHaveBeenCalledTimes(1);
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
