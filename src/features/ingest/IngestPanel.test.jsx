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

  it("mantém o resultado do refresh quando a carga inicial termina atrasada", async () => {
    let resolveInitial;
    const initialRequest = new Promise((resolve) => { resolveInitial = resolve; });
    loadJobIngestions.mockReturnValueOnce(initialRequest);
    processJobIngestion.mockResolvedValue({ outcome: "registered", job: {} });
    const refreshedPage = {
      items: [{ id: "ing-current", payload_title: "Resultado atualizado", source_kind: "manual_fixture" }],
      hasNext: false,
      page: 1,
      pageSize: 24,
    };
    render(<IngestPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Nova fixture" }));
    fireEvent.click(screen.getByRole("button", { name: "Ingerir fixture (pendente)" }));
    loadJobIngestions.mockResolvedValueOnce(refreshedPage);

    expect(await screen.findByText("Resultado atualizado")).toBeInTheDocument();
    resolveInitial(emptyPage);
    await waitFor(() => expect(screen.getByText("Resultado atualizado")).toBeInTheDocument());
  });

  it("descarta o detalhe antigo quando outra ingestão é selecionada", async () => {
    let resolveFirstDetail;
    const firstDetail = new Promise((resolve) => { resolveFirstDetail = resolve; });
    const secondDetail = {
      id: "ing-2",
      source_kind: "manual_fixture",
      normalized_locator: "fixture:second",
      payload_title: "Segunda ingestão",
      latest_outcome: "registered",
      job_ingestion_attempts: [],
    };
    loadJobIngestions.mockResolvedValue({
      items: [
        { id: "ing-1", payload_title: "Primeira ingestão", source_kind: "manual_fixture" },
        { id: "ing-2", payload_title: "Segunda ingestão", source_kind: "manual_fixture" },
      ],
      hasNext: false,
      page: 1,
      pageSize: 24,
    });

    render(<IngestPanel />);
    const firstRow = await screen.findByText("Primeira ingestão");
    loadJobIngestionDetail.mockReturnValueOnce(firstDetail);
    fireEvent.click(within(firstRow.closest(".admin-ingest__row")).getByRole("button", { name: "Ver detalhes" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar às ingestões" }));
    loadJobIngestionDetail.mockResolvedValueOnce(secondDetail);
    fireEvent.click(within(screen.getByText("Segunda ingestão").closest(".admin-ingest__row")).getByRole("button", { name: "Ver detalhes" }));

    expect(await screen.findByText("fixture:second")).toBeInTheDocument();
    resolveFirstDetail({
      id: "ing-1",
      source_kind: "manual_fixture",
      normalized_locator: "fixture:first",
      payload_title: "Primeira ingestão",
      latest_outcome: "registered",
      job_ingestion_attempts: [],
    });

    await waitFor(() => expect(screen.getByRole("heading", { name: "Segunda ingestão" })).toBeInTheDocument());
    expect(screen.queryByText("fixture:first")).not.toBeInTheDocument();
  });

  it("permite tentar novamente após falha ao carregar um detalhe", async () => {
    loadJobIngestions.mockResolvedValue({
      items: [{ id: "ing-retry", payload_title: "Ingestão recuperável", source_kind: "manual_fixture" }],
      hasNext: false,
      page: 1,
      pageSize: 24,
    });
    loadJobIngestionDetail
      .mockRejectedValueOnce(new Error("Falha transitória."))
      .mockResolvedValueOnce({
        id: "ing-retry",
        source_kind: "manual_fixture",
        normalized_locator: "fixture:recovered",
        payload_title: "Ingestão recuperável",
        latest_outcome: "registered",
        job_ingestion_attempts: [],
      });

    render(<IngestPanel />);
    const row = await screen.findByText("Ingestão recuperável");
    fireEvent.click(within(row.closest(".admin-ingest__row")).getByRole("button", { name: "Ver detalhes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha transitória.");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("fixture:recovered")).toBeInTheDocument();
  });

  it("não reabre o detalhe se a pessoa voltar à lista durante um reprocessamento", async () => {
    loadJobIngestions.mockResolvedValue({
      items: [{
        id: "ing-reprocess",
        source_kind: "manual_fixture",
        normalized_locator: "fixture:reprocess",
        payload_title: "Ingestão em reprocessamento",
        latest_outcome: "registered",
      }],
      hasNext: false,
      page: 1,
      pageSize: 24,
    });
    loadJobIngestionDetail.mockResolvedValue({
      id: "ing-reprocess",
      source_kind: "manual_fixture",
      normalized_locator: "fixture:reprocess",
      payload_title: "Ingestão em reprocessamento",
      latest_outcome: "registered",
      canonical_payload: { title: "Ingestão em reprocessamento", company_name: "Empresa fictícia" },
      job_ingestion_attempts: [],
    });
    let resolveProcess;
    processJobIngestion.mockReturnValueOnce(new Promise((resolve) => { resolveProcess = resolve; }));

    render(<IngestPanel />);
    const row = await screen.findByText("Ingestão em reprocessamento");
    fireEvent.click(within(row.closest(".admin-ingest__row")).getByRole("button", { name: "Ver detalhes" }));
    expect(await screen.findByRole("button", { name: "Reprocessar" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Reprocessar" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar às ingestões" }));
    resolveProcess({ outcome: "registered", job: { status: "pending" } });

    expect(await screen.findByRole("button", { name: "Nova fixture" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText("Detalhe da ingestão")).not.toBeInTheDocument());
  });

  it("ignora a carga pendente depois que a tela é desmontada", async () => {
    let resolveRows;
    const pendingRows = new Promise((resolve) => { resolveRows = resolve; });
    loadJobIngestions.mockReturnValueOnce(pendingRows);
    const { unmount } = render(<IngestPanel />);
    unmount();

    resolveRows({
      items: [{ id: "ing-unmounted", payload_title: "Resposta após saída", source_kind: "manual_fixture" }],
      hasNext: false,
      page: 1,
      pageSize: 24,
    });
    await pendingRows;
    await Promise.resolve();
    expect(screen.queryByText("Resposta após saída")).not.toBeInTheDocument();
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
