import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const loadCurationQueue = vi.hoisted(() => vi.fn());
const curationEvents = vi.hoisted(() => ({ notify() {} }));
const loadCurationJobDetail = vi.hoisted(() =>
  vi.fn(async () => ({
    id: "job-1",
    description: "Vaga fictícia para curadoria.",
    stack: ["React"],
    reviews: [],
  })),
);
const peekCurationQueueCache = vi.hoisted(() => vi.fn(() => null));
const setJobCurationPriority = vi.hoisted(() => vi.fn());

vi.mock("./curation-api.js", () => ({
  loadCurationQueue: (...args) => loadCurationQueue(...args),
  loadCurationJobDetail: (...args) => loadCurationJobDetail(...args),
  peekCurationQueueCache: (...args) => peekCurationQueueCache(...args),
  subscribeCurationJobs: (listener) => {
    curationEvents.notify = listener;
    return () => {
      curationEvents.notify = () => {};
    };
  },
  submitCurationReview: vi.fn(),
  resubmitJobForCuration: vi.fn(),
  setJobCurationPriority: (...args) => setJobCurationPriority(...args),
}));

import { CurationQueue } from "./CurationQueue.jsx";
import { mergeCurationQueue } from "./curation-queue.js";

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

const normalQueuePayload = {
  ...queuePayload,
  queue: [{ ...queuePayload.queue[0], priority: "normal" }],
};

const curatorProfile = {
  role: "curator",
  full_name: "Curador Homolog",
  email: "curator-homolog@example.invalid",
};

const adminProfile = {
  role: "admin",
  full_name: "Admin Homolog",
  email: "admin-homolog@example.invalid",
};

async function selectQueueJob(name) {
  fireEvent.click(await screen.findByRole("button", { name }));
}

async function markUrgent(reason = "SLA interno") {
  fireEvent.change(screen.getByLabelText("Motivo interno para urgente"), {
    target: { value: reason },
  });
  fireEvent.click(screen.getByRole("button", { name: "Urgente" }));
}

describe("CurationQueue", () => {
  beforeEach(() => {
    loadCurationQueue.mockReset();
    loadCurationQueue.mockResolvedValue(queuePayload);
    loadCurationJobDetail.mockReset();
    loadCurationJobDetail.mockResolvedValue({
      id: "job-1",
      description: "Vaga fictícia para curadoria.",
      stack: ["React"],
      reviews: [],
    });
    peekCurationQueueCache.mockReset();
    peekCurationQueueCache.mockReturnValue(null);
    setJobCurationPriority.mockReset();
    setJobCurationPriority.mockResolvedValue({ ok: true });
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
        profile={curatorProfile}
      />,
    );

    expect(screen.getByText("Carregando fila de curadoria…")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Carregando fila de curadoria…");
    expect(screen.queryByRole("heading", { name: "Pessoa Dev Front-end (fila)" })).not.toBeInTheDocument();

    resolveQueue(queuePayload);

    expect(await screen.findByRole("button", { name: /Pessoa Dev Front-end \(fila\)/ })).toBeInTheDocument();
    expect(loadCurationJobDetail).not.toHaveBeenCalled();
    expect(screen.queryByText("Carregando fila de curadoria…")).not.toBeInTheDocument();
    expect(loadCurationQueue).toHaveBeenCalledWith({ scope: "pending", page: 1, forceRefresh: false });
  });

  it("reusa o cache no remount e não mostra o gate de loading", async () => {
    peekCurationQueueCache.mockReturnValue(queuePayload);

    render(
      <CurationQueue
        includeRejected={false}
        profile={curatorProfile}
      />,
    );

    expect(screen.queryByText("Carregando fila de curadoria…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pessoa Dev Front-end \(fila\)/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pessoa Dev Front-end (fila)" })).not.toBeInTheDocument();
    expect(loadCurationJobDetail).not.toHaveBeenCalled();
    expect(loadCurationQueue).toHaveBeenCalledWith({ scope: "pending", page: 1, forceRefresh: true });
  });

  it("lista a fila e a rubrica sem chamar Supabase no JSX", async () => {
    render(
      <CurationQueue
        includeRejected={false}
        profile={curatorProfile}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Fila de revisão" })).toBeInTheDocument();
    expect(document.querySelector(".admin-user")).toBeNull();
    expect(screen.queryByText("Curador Homolog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sair/i })).not.toBeInTheDocument();
    expect(loadCurationJobDetail).not.toHaveBeenCalled();
    await selectQueueJob(/Pessoa Dev Front-end \(fila\)/);
    expect(await screen.findByRole("heading", { name: "Pessoa Dev Front-end (fila)" })).toBeInTheDocument();
    fireEvent.click(await screen.findByText("Histórico de pareceres (0)"));
    expect(screen.getByText("Ainda sem parecer nesta vaga.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Iniciar parecer" }));
    expect(screen.getByText("Empresa e oportunidade identificáveis")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Enviar parecer/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Aprovar/i })).toHaveAttribute("name", "decision");
    expect(screen.getByRole("radio", { name: /Aprovar/i })).toHaveAttribute("id", "curation-decision-approve");
    expect(screen.getByLabelText("Comentário interno (opcional)")).toHaveAttribute("id", "curation-comment");
    expect(screen.getByLabelText("Comentário interno (opcional)")).toHaveAttribute("name", "comment");
    const unnamed = [...document.querySelectorAll("input, select, textarea")].filter((el) => !el.id && !el.name);
    expect(unnamed).toEqual([]);
  });

  it("mantém a vaga selecionada no reload e não troca o detalhe se ela sair da página", async () => {
    const job1 = queuePayload.queue[0];
    const job2 = {
      ...job1,
      id: "job-2",
      title: "Pessoa QA (fila)",
      priority: "normal",
    };
    loadCurationQueue
      .mockResolvedValueOnce({ ...queuePayload, queue: [job1, job2], hasNext: false, page: 1 })
      .mockResolvedValueOnce({ ...queuePayload, queue: [job1, job2], hasNext: false, page: 1 })
      .mockResolvedValueOnce({ ...queuePayload, queue: [job1], hasNext: false, page: 1 });

    render(<CurationQueue includeRejected={false} profile={curatorProfile} />);

    expect(await screen.findByRole("button", { name: /Pessoa QA \(fila\)/ })).toBeInTheDocument();
    expect(loadCurationJobDetail).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Pessoa QA \(fila\)/ }));
    expect(await screen.findByRole("heading", { name: "Pessoa QA (fila)" })).toBeInTheDocument();

    curationEvents.notify();
    expect(await screen.findByRole("heading", { name: "Pessoa QA (fila)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pessoa QA \(fila\)/ })).toHaveAttribute("aria-pressed", "true");

    curationEvents.notify();
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Pessoa QA (fila)" })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: "Pessoa Dev Front-end (fila)" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pessoa Dev Front-end \(fila\)/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "Iniciar parecer" })).not.toBeInTheDocument();
  });

  it("no mobile devolve a fila quando a vaga selecionada sai da página", async () => {
    window.innerWidth = 390;
    const job1 = queuePayload.queue[0];
    const job2 = {
      ...job1,
      id: "job-2",
      title: "Pessoa QA (fila)",
      priority: "normal",
    };
    loadCurationQueue
      .mockResolvedValueOnce({ ...queuePayload, queue: [job1, job2], hasNext: false, page: 1 })
      .mockResolvedValue({ ...queuePayload, queue: [job1], hasNext: false, page: 1 });

    render(<CurationQueue includeRejected={false} profile={curatorProfile} />);
    await selectQueueJob(/Pessoa QA \(fila\)/);
    expect(await screen.findByRole("heading", { name: "Pessoa QA (fila)" })).toBeInTheDocument();
    expect(document.querySelector(".curation-workspace")).toHaveClass("curation-workspace--detail-open");

    curationEvents.notify();

    await waitFor(() => {
      expect(document.querySelector(".curation-workspace")).not.toHaveClass("curation-workspace--detail-open");
    });
    const queue = screen.getByRole("region", { name: "Vagas pendentes" });
    expect(queue).toBeVisible();
    expect(screen.getByRole("heading", { name: "Pendentes", level: 2 })).toBeVisible();
    expect(screen.getByRole("button", { name: /Pessoa Dev Front-end \(fila\)/ })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Pessoa QA (fila)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Iniciar parecer" })).not.toBeInTheDocument();
  });

  it("não reabre o detalhe se a vaga sair e voltar sem novo clique", async () => {
    const job1 = queuePayload.queue[0];
    const job2 = {
      ...job1,
      id: "job-2",
      title: "Pessoa QA (fila)",
      priority: "normal",
    };
    loadCurationQueue
      .mockResolvedValueOnce({ ...queuePayload, queue: [job1, job2], hasNext: false, page: 1 })
      .mockResolvedValueOnce({ ...queuePayload, queue: [job1], hasNext: false, page: 1 })
      .mockResolvedValueOnce({ ...queuePayload, queue: [job1, job2], hasNext: false, page: 1 });

    render(<CurationQueue includeRejected={false} profile={curatorProfile} />);
    await selectQueueJob(/Pessoa QA \(fila\)/);
    expect(await screen.findByRole("heading", { name: "Pessoa QA (fila)" })).toBeInTheDocument();

    curationEvents.notify();
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Pessoa QA (fila)" })).not.toBeInTheDocument();
    });
    const callsAfterRemoval = loadCurationJobDetail.mock.calls.length;

    curationEvents.notify();
    expect(await screen.findByRole("button", { name: /Pessoa QA \(fila\)/ })).toHaveAttribute("aria-pressed", "false");
    await waitFor(() => {
      expect(loadCurationQueue).toHaveBeenCalledTimes(3);
    });
    expect(screen.queryByRole("heading", { name: "Pessoa QA (fila)" })).not.toBeInTheDocument();
    expect(document.querySelector(".curation-workspace")).not.toHaveClass("curation-workspace--detail-open");
    expect(loadCurationJobDetail).toHaveBeenCalledTimes(callsAfterRemoval);

    fireEvent.click(screen.getByRole("button", { name: /Pessoa QA \(fila\)/ }));
    expect(await screen.findByRole("heading", { name: "Pessoa QA (fila)" })).toBeInTheDocument();
    await waitFor(() => {
      expect(loadCurationJobDetail).toHaveBeenCalledTimes(callsAfterRemoval + 1);
    });
    expect(loadCurationJobDetail).toHaveBeenLastCalledWith("job-2", { forceRefresh: true });
  });

  it("busca descrição e pareceres só depois do clique na fila", async () => {
    render(<CurationQueue includeRejected={false} profile={curatorProfile} />);

    expect(await screen.findByRole("button", { name: /Pessoa Dev Front-end \(fila\)/ })).toBeInTheDocument();
    expect(loadCurationQueue).toHaveBeenCalledWith({ scope: "pending", page: 1, forceRefresh: false });
    expect(loadCurationJobDetail).not.toHaveBeenCalled();

    await selectQueueJob(/Pessoa Dev Front-end \(fila\)/);

    await waitFor(() => {
      expect(loadCurationJobDetail).toHaveBeenCalledWith("job-1", { forceRefresh: false });
    });
    expect(loadCurationJobDetail).toHaveBeenCalledTimes(1);
  });

  it("limpa o erro da fila após um reload bem-sucedido", async () => {
    loadCurationQueue
      .mockRejectedValueOnce(new Error("fila indisponível"))
      .mockResolvedValue(queuePayload);

    render(<CurationQueue includeRejected={false} profile={curatorProfile} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("fila indisponível");
    curationEvents.notify();
    expect(await screen.findByRole("button", { name: /Pessoa Dev Front-end \(fila\)/ })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("descarta a resposta antiga quando um reload mais novo já chegou", async () => {
    let resolveFirst;
    let resolveSecond;
    loadCurationQueue
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

    render(<CurationQueue includeRejected={false} profile={curatorProfile} />);
    await waitFor(() => expect(loadCurationQueue).toHaveBeenCalledTimes(1));
    curationEvents.notify();
    await waitFor(() => expect(loadCurationQueue).toHaveBeenCalledTimes(2));

    const stale = {
      ...queuePayload,
      queue: [{ ...queuePayload.queue[0], id: "job-stale", title: "Vaga obsoleta" }],
    };
    const fresh = {
      ...queuePayload,
      queue: [{ ...queuePayload.queue[0], id: "job-fresh", title: "Vaga recente" }],
    };

    await act(async () => {
      resolveSecond(fresh);
    });
    expect(await screen.findByRole("button", { name: /Vaga recente/ })).toBeInTheDocument();

    await act(async () => {
      resolveFirst(stale);
    });
    expect(screen.getByRole("button", { name: /Vaga recente/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Vaga obsoleta/ })).not.toBeInTheDocument();
  });

  it("loadMore lento + reload não deixa o botão em Carregando…", async () => {
    const job1 = queuePayload.queue[0];
    const extra = { ...job1, id: "job-old-page", title: "Página antiga" };
    const fresh = { ...job1, id: "job-fresh", title: "Vaga recente" };
    let resolveMore;
    loadCurationQueue.mockImplementation(async (opts = {}) => {
      if ((opts.page ?? 1) > 1) {
        return new Promise((resolve) => { resolveMore = resolve; });
      }
      const firstPageCalls = loadCurationQueue.mock.calls.filter(
        ([arg]) => (arg?.scope ?? "pending") === "pending" && (arg?.page ?? 1) === 1,
      ).length;
      if (firstPageCalls > 1) {
        return { ...queuePayload, queue: [fresh], hasNext: true, page: 1 };
      }
      return { ...queuePayload, queue: [job1], hasNext: true, page: 1 };
    });

    render(<CurationQueue includeRejected={false} profile={curatorProfile} />);
    fireEvent.click(await screen.findByRole("button", { name: "Carregar mais" }));
    expect(await screen.findByRole("button", { name: "Carregando…" })).toBeDisabled();

    curationEvents.notify();
    expect(await screen.findByRole("button", { name: /Vaga recente/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Carregando…" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Carregar mais" })).toBeEnabled();

    await act(async () => {
      resolveMore({ ...queuePayload, queue: [extra], rejected: [], hasNext: false, page: 2 });
    });
    expect(screen.queryByRole("button", { name: /Página antiga/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Carregando…" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Carregar mais" })).toBeEnabled();
  });
});

describe("CurationQueue Sprint 20A", () => {
  beforeEach(() => {
    loadCurationQueue.mockReset();
    loadCurationQueue.mockResolvedValue({
      ...queuePayload,
      rejected: [{ ...queuePayload.queue[0], id: "rejected-1", title: "Vaga rejeitada", priority: "normal" }],
    });
    loadCurationJobDetail.mockReset();
    loadCurationJobDetail.mockResolvedValue({
      id: "rejected-1",
      description: "Vaga fictícia para curadoria.",
      stack: ["React"],
      reviews: [],
    });
    peekCurationQueueCache.mockReset();
    peekCurationQueueCache.mockReturnValue(null);
  });

  it("admin encontra rejeitadas em filtro e o reenvio no detalhe, sem formulário de parecer", async () => {
    render(<CurationQueue includeRejected profile={adminProfile} />);
    fireEvent.click(await screen.findByRole("button", { name: /Rejeitadas/ }));
    expect(loadCurationJobDetail).not.toHaveBeenCalled();
    await selectQueueJob(/Vaga rejeitada/);
    expect(await screen.findByRole("heading", { name: "Vaga rejeitada" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reenviar para curadoria" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Iniciar parecer" })).not.toBeInTheDocument();
  });

  it("curator não recebe a vista de rejeitadas nem prioridade admin", async () => {
    render(<CurationQueue includeRejected={false} profile={curatorProfile} />);
    expect(await screen.findByRole("button", { name: /Pessoa Dev Front-end \(fila\)/ })).toBeInTheDocument();
    expect(loadCurationJobDetail).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Rejeitadas/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Urgente" })).not.toBeInTheDocument();
  });
});

describe("CurationQueue prioridade admin (UX-CURATION-PRIORITY-FEEDBACK-01)", () => {
  beforeEach(() => {
    loadCurationQueue.mockReset();
    loadCurationQueue.mockResolvedValue(normalQueuePayload);
    loadCurationJobDetail.mockReset();
    loadCurationJobDetail.mockResolvedValue({
      id: "job-1",
      description: "Vaga fictícia para curadoria.",
      stack: ["React"],
      reviews: [],
    });
    peekCurationQueueCache.mockReset();
    peekCurationQueueCache.mockReturnValue(null);
    setJobCurationPriority.mockReset();
    setJobCurationPriority.mockResolvedValue({ ok: true });
  });

  it("mostra salvando e, após o servidor, atualiza o controle para Urgente com status ao lado", async () => {
    let resolveSave;
    setJobCurationPriority.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = () => resolve({ ok: true });
        }),
    );

    render(<CurationQueue includeRejected={false} profile={adminProfile} />);
    await selectQueueJob(/Pessoa Dev Front-end \(fila\)/);
    expect(await screen.findByRole("button", { name: "Urgente" })).toHaveAttribute("aria-pressed", "false");

    await markUrgent();

    const control = document.querySelector(".curation-priority-control");
    const feedback = control.querySelector(".curation-priority-feedback");
    expect(within(control).getByRole("status")).toHaveTextContent("Salvando prioridade…");
    expect(feedback).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("button", { name: "Salvando…" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Urgente" })).not.toBeInTheDocument();

    resolveSave();

    expect(await screen.findByRole("button", { name: "Urgente" })).toHaveAttribute("aria-pressed", "true");
    const feedbackAfter = document.querySelector(".curation-priority-feedback");
    expect(within(feedbackAfter).getByRole("status")).toHaveTextContent("Prioridade urgente registrada.");
    expect(feedbackAfter).toHaveAttribute("aria-live", "polite");
    expect(setJobCurationPriority).toHaveBeenCalledWith("job-1", "urgent", "SLA interno");
    expect(document.querySelector(".success")?.closest(".curation-priority-feedback")).toBeTruthy();
  });

  it("em falha mantém o estado anterior e mostra o erro junto à ação", async () => {
    setJobCurationPriority.mockRejectedValue(new Error("cannot review own submission"));

    render(<CurationQueue includeRejected={false} profile={adminProfile} />);
    await selectQueueJob(/Pessoa Dev Front-end \(fila\)/);
    expect(await screen.findByRole("button", { name: "Urgente" })).toHaveAttribute("aria-pressed", "false");

    await markUrgent();

    const control = document.querySelector(".curation-priority-control");
    expect(await within(control).findByRole("alert")).toHaveTextContent("cannot review own submission");
    expect(screen.getByRole("button", { name: "Urgente" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "Urgente", pressed: true })).not.toBeInTheDocument();
    expect(document.querySelector(".success")).toBeNull();
    expect(screen.getByLabelText("Motivo interno para urgente")).not.toHaveAttribute("aria-invalid");
  });

  it("associa o erro de motivo obrigatório ao campo", async () => {
    render(<CurationQueue includeRejected={false} profile={adminProfile} />);
    await selectQueueJob(/Pessoa Dev Front-end \(fila\)/);
    fireEvent.click(await screen.findByRole("button", { name: "Urgente" }));

    const input = screen.getByLabelText("Motivo interno para urgente");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Motivo interno é obrigatório para prioridade urgente.");
    expect(alert).toHaveAttribute("id", "curation-priority-reason-error");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "curation-priority-reason-error");
    expect(setJobCurationPriority).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Urgente" })).toHaveAttribute("aria-pressed", "false");
  });

  it("ignora a resposta atrasada depois de trocar de vaga", async () => {
    const twoJobsPayload = {
      ...normalQueuePayload,
      queue: [
        { ...normalQueuePayload.queue[0], id: "job-1", title: "Vaga Alfa", priority: "normal" },
        { ...normalQueuePayload.queue[0], id: "job-2", title: "Vaga Beta", priority: "normal" },
      ],
    };
    loadCurationQueue.mockResolvedValue(twoJobsPayload);

    let resolveSave;
    setJobCurationPriority.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = () => {
            loadCurationQueue.mockResolvedValue({
              ...twoJobsPayload,
              queue: twoJobsPayload.queue.map((job) =>
                job.id === "job-1" ? { ...job, priority: "urgent" } : job,
              ),
            });
            resolve({ ok: true });
          };
        }),
    );

    render(<CurationQueue includeRejected={false} profile={adminProfile} />);
    expect(loadCurationJobDetail).not.toHaveBeenCalled();
    await selectQueueJob(/Vaga Alfa/);
    expect(loadCurationJobDetail).toHaveBeenCalledWith("job-1", { forceRefresh: false });
    expect(await screen.findByRole("heading", { name: "Vaga Alfa" })).toBeInTheDocument();
    await markUrgent();
    fireEvent.click(screen.getByRole("button", { name: /Vaga Beta/ }));

    expect(await screen.findByRole("heading", { name: "Vaga Beta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Urgente" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("Prioridade urgente registrada.")).not.toBeInTheDocument();

    resolveSave();
    await waitFor(() => {
      expect(setJobCurationPriority).toHaveBeenCalledWith("job-1", "urgent", "SLA interno");
    });
    expect(screen.getByRole("heading", { name: "Vaga Beta" })).toBeInTheDocument();
    expect(screen.queryByText("Prioridade urgente registrada.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Urgente" })).toHaveAttribute("aria-pressed", "false");
  });

  it("atualiza prioridade na fila local sem recarregar a lista após salvar", async () => {
    render(<CurationQueue includeRejected={false} profile={adminProfile} />);
    await selectQueueJob(/Pessoa Dev Front-end \(fila\)/);
    const callsBeforeSave = loadCurationQueue.mock.calls.length;
    await markUrgent();

    expect(await screen.findByRole("button", { name: "Urgente" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Pessoa Dev Front-end \(fila\)/ })).toBeInTheDocument();
    expect(loadCurationQueue.mock.calls.length).toBe(callsBeforeSave);
    const feedback = document.querySelector(".curation-priority-feedback");
    expect(within(feedback).getByRole("status")).toHaveTextContent("Prioridade urgente registrada.");
    expect(setJobCurationPriority).toHaveBeenCalledWith("job-1", "urgent", "SLA interno");
  });

  it("reordena a fila localmente ao marcar urgente (urgentes primeiro)", async () => {
    const jobs = [
      {
        ...normalQueuePayload.queue[0],
        id: "job-a",
        title: "Vaga normal antiga",
        priority: "normal",
        created_at: "2026-08-16T10:00:00Z",
      },
      {
        ...normalQueuePayload.queue[0],
        id: "job-b",
        title: "Vaga normal recente",
        priority: "normal",
        created_at: "2026-08-16T12:00:00Z",
      },
    ];
    loadCurationQueue.mockResolvedValue({
      ...normalQueuePayload,
      queue: mergeCurationQueue(jobs, []),
    });

    render(<CurationQueue includeRejected={false} profile={adminProfile} />);
    await selectQueueJob(/Vaga normal antiga/);
    await markUrgent();

    await waitFor(() => {
      const rows = screen.getAllByRole("button", { name: /Vaga normal/ });
      expect(rows[0]).toHaveAccessibleName(/Vaga normal antiga/);
      expect(within(rows[0].closest(".curation-workspace__queue-item")).getByText("Urgente")).toBeInTheDocument();
    });
  });

  it("o botão é nativo, focável e dispara a ação com o controle focado", async () => {
    render(<CurationQueue includeRejected={false} profile={adminProfile} />);
    await selectQueueJob(/Pessoa Dev Front-end \(fila\)/);
    const btn = await screen.findByRole("button", { name: "Urgente" });
    expect(btn.tagName).toBe("BUTTON");
    expect(btn).toHaveAttribute("type", "button");
    btn.focus();
    expect(btn).toHaveFocus();
    fireEvent.change(screen.getByLabelText("Motivo interno para urgente"), {
      target: { value: "SLA interno" },
    });
    fireEvent.keyDown(btn, { key: "Enter" });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(setJobCurationPriority).toHaveBeenCalledTimes(1);
      expect(setJobCurationPriority).toHaveBeenCalledWith("job-1", "urgent", "SLA interno");
    });
    expect(await screen.findByRole("button", { name: "Urgente" })).toBeInTheDocument();
  });

  it("no viewport mobile com a página rolada o feedback permanece no fluxo junto ao controle", async () => {
    window.innerWidth = 390;
    window.innerHeight = 667;
    Object.defineProperty(document.documentElement, "scrollTop", { configurable: true, value: 640 });

    render(<CurationQueue includeRejected={false} profile={adminProfile} />);
    await selectQueueJob(/Pessoa Dev Front-end \(fila\)/);
    expect(await screen.findByRole("button", { name: "Urgente" })).toBeInTheDocument();
    await markUrgent("Fila da semana");
    await waitFor(() => {
      expect(screen.getByText("Prioridade urgente registrada.")).toBeInTheDocument();
    });
    const feedback = document.querySelector(".curation-priority-feedback");
    expect(feedback.contains(screen.getByRole("status"))).toBe(true);
    expect(feedback.closest(".curation-priority-control")).toBeTruthy();
    expect(getComputedStyle(feedback).position).not.toBe("fixed");
    expect(getComputedStyle(feedback).position).not.toBe("sticky");

    const css = readFileSync(resolve("src/styles.css"), "utf8");
    expect(css).toMatch(/\.curation-priority-feedback\{[^}]*position:static/);
    expect(css).toMatch(/@media\(max-width:760px\)\{\s*\.curation-priority-feedback/);
  });
});
