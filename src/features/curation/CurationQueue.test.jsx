import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const loadCurationQueue = vi.hoisted(() => vi.fn());
const peekCurationQueueCache = vi.hoisted(() => vi.fn(() => null));
const setJobCurationPriority = vi.hoisted(() => vi.fn());

vi.mock("./curation-api.js", () => ({
  loadCurationQueue: (...args) => loadCurationQueue(...args),
  peekCurationQueueCache: (...args) => peekCurationQueueCache(...args),
  subscribeCurationJobs: () => () => {},
  submitCurationReview: vi.fn(),
  resubmitJobForCuration: vi.fn(),
  setJobCurationPriority: (...args) => setJobCurationPriority(...args),
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

async function markUrgent(reason = "SLA interno") {
  fireEvent.change(screen.getByLabelText("Motivo interno para urgente"), {
    target: { value: reason },
  });
  fireEvent.click(screen.getByRole("button", { name: "Marcar urgente" }));
}

describe("CurationQueue", () => {
  beforeEach(() => {
    loadCurationQueue.mockReset();
    loadCurationQueue.mockResolvedValue(queuePayload);
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

    expect(await screen.findByRole("heading", { name: "Pessoa Dev Front-end (fila)" })).toBeInTheDocument();
    expect(screen.queryByText("Carregando fila de curadoria…")).not.toBeInTheDocument();
    expect(loadCurationQueue).toHaveBeenCalledWith({ includeRejected: false, forceRefresh: false });
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
    expect(screen.getByRole("heading", { name: "Pessoa Dev Front-end (fila)" })).toBeInTheDocument();
    expect(loadCurationQueue).toHaveBeenCalledWith({ includeRejected: false, forceRefresh: true });
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
    expect(screen.getByRole("heading", { name: "Pessoa Dev Front-end (fila)" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Histórico de pareceres (0)"));
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
});

describe("CurationQueue Sprint 20A", () => {
  beforeEach(() => {
    loadCurationQueue.mockReset();
    loadCurationQueue.mockResolvedValue({
      ...queuePayload,
      rejected: [{ ...queuePayload.queue[0], id: "rejected-1", title: "Vaga rejeitada", priority: "normal" }],
    });
    peekCurationQueueCache.mockReset();
    peekCurationQueueCache.mockReturnValue(null);
  });

  it("admin encontra rejeitadas em filtro e o reenvio no detalhe, sem formulário de parecer", async () => {
    render(<CurationQueue includeRejected profile={adminProfile} />);
    fireEvent.click(await screen.findByRole("button", { name: /Rejeitadas 1/ }));
    expect(screen.getByRole("heading", { name: "Vaga rejeitada" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reenviar para curadoria" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Iniciar parecer" })).not.toBeInTheDocument();
  });

  it("curator não recebe a vista de rejeitadas nem prioridade admin", async () => {
    render(<CurationQueue includeRejected={false} profile={curatorProfile} />);
    await screen.findByRole("heading", { name: "Pessoa Dev Front-end (fila)" });
    expect(screen.queryByRole("button", { name: /Rejeitadas/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar urgente" })).not.toBeInTheDocument();
  });
});

describe("CurationQueue prioridade admin (UX-CURATION-PRIORITY-FEEDBACK-01)", () => {
  beforeEach(() => {
    loadCurationQueue.mockReset();
    loadCurationQueue.mockResolvedValue(normalQueuePayload);
    peekCurationQueueCache.mockReset();
    peekCurationQueueCache.mockReturnValue(null);
    setJobCurationPriority.mockReset();
    setJobCurationPriority.mockImplementation(async (_jobId, nextPriority) => {
      loadCurationQueue.mockResolvedValue({
        ...normalQueuePayload,
        queue: [{ ...normalQueuePayload.queue[0], priority: nextPriority }],
      });
      return { ok: true };
    });
  });

  it("mostra salvando e, após o servidor, atualiza o controle para Urgente com status ao lado", async () => {
    let resolveSave;
    setJobCurationPriority.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = () => {
            loadCurationQueue.mockResolvedValue({
              ...normalQueuePayload,
              queue: [{ ...normalQueuePayload.queue[0], priority: "urgent" }],
            });
            resolve({ ok: true });
          };
        }),
    );

    render(<CurationQueue includeRejected={false} profile={adminProfile} />);
    expect(await screen.findByRole("button", { name: "Marcar urgente" })).toHaveAttribute("aria-pressed", "false");

    await markUrgent();

    const control = document.querySelector(".curation-priority-control");
    expect(within(control).getByRole("status")).toHaveTextContent("Salvando prioridade…");
    expect(within(control).getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("button", { name: "Salvando…" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Marcar urgente" })).not.toBeInTheDocument();

    resolveSave();

    expect(await screen.findByRole("button", { name: "Urgente" })).toHaveAttribute("aria-pressed", "true");
    const feedback = document.querySelector(".curation-priority-feedback");
    expect(within(feedback).getByRole("status")).toHaveTextContent("Prioridade urgente registrada.");
    expect(within(feedback).getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(setJobCurationPriority).toHaveBeenCalledWith("job-1", "urgent", "SLA interno");
    expect(document.querySelector(".success")?.closest(".curation-priority-feedback")).toBeTruthy();
  });

  it("em falha mantém o estado anterior e mostra o erro junto à ação", async () => {
    setJobCurationPriority.mockRejectedValue(new Error("cannot review own submission"));

    render(<CurationQueue includeRejected={false} profile={adminProfile} />);
    expect(await screen.findByRole("button", { name: "Marcar urgente" })).toHaveAttribute("aria-pressed", "false");

    await markUrgent();

    const control = document.querySelector(".curation-priority-control");
    expect(await within(control).findByRole("alert")).toHaveTextContent("cannot review own submission");
    expect(screen.getByRole("button", { name: "Marcar urgente" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "Urgente" })).not.toBeInTheDocument();
    expect(document.querySelector(".success")).toBeNull();
    expect(screen.getByLabelText("Motivo interno para urgente")).not.toHaveAttribute("aria-invalid");
  });

  it("associa o erro de motivo obrigatório ao campo", async () => {
    render(<CurationQueue includeRejected={false} profile={adminProfile} />);
    fireEvent.click(await screen.findByRole("button", { name: "Marcar urgente" }));

    const input = screen.getByLabelText("Motivo interno para urgente");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Motivo interno é obrigatório para prioridade urgente.");
    expect(alert).toHaveAttribute("id", "curation-priority-reason-error");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "curation-priority-reason-error");
    expect(setJobCurationPriority).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Marcar urgente" })).toHaveAttribute("aria-pressed", "false");
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
    expect(await screen.findByRole("heading", { name: "Vaga Alfa" })).toBeInTheDocument();
    await markUrgent();
    fireEvent.click(screen.getByRole("button", { name: /Vaga Beta/ }));

    expect(await screen.findByRole("heading", { name: "Vaga Beta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar urgente" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("Prioridade urgente registrada.")).not.toBeInTheDocument();

    resolveSave();
    await waitFor(() => {
      expect(setJobCurationPriority).toHaveBeenCalledWith("job-1", "urgent", "SLA interno");
    });
    expect(screen.getByRole("heading", { name: "Vaga Beta" })).toBeInTheDocument();
    expect(screen.queryByText("Prioridade urgente registrada.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar urgente" })).toHaveAttribute("aria-pressed", "false");
  });

  it("não trata falha ao atualizar a fila como falha ao salvar", async () => {
    setJobCurationPriority.mockImplementation(async () => {
      loadCurationQueue.mockRejectedValue(new Error("fila indisponível"));
      return { ok: true };
    });

    render(<CurationQueue includeRejected={false} profile={adminProfile} />);
    expect(await screen.findByRole("button", { name: "Marcar urgente" })).toBeInTheDocument();
    await markUrgent();

    expect(await screen.findByRole("button", { name: "Urgente" })).toHaveAttribute("aria-pressed", "true");
    const feedback = document.querySelector(".curation-priority-feedback");
    expect(within(feedback).getByRole("status")).toHaveTextContent("Prioridade urgente registrada.");
    expect(feedback.querySelector(".form-alert")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("fila indisponível");
    expect(setJobCurationPriority).toHaveBeenCalledWith("job-1", "urgent", "SLA interno");
  });

  it("o botão é nativo, focável e dispara a ação com o controle focado", async () => {
    render(<CurationQueue includeRejected={false} profile={adminProfile} />);
    const btn = await screen.findByRole("button", { name: "Marcar urgente" });
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
    expect(await screen.findByRole("button", { name: "Marcar urgente" })).toBeInTheDocument();
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
