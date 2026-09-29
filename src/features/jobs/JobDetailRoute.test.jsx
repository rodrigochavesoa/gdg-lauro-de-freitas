import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";

const cache = vi.hoisted(() => new Map());
const loadApprovedJobMock = vi.hoisted(() => vi.fn());
const loadMyApplicationMock = vi.hoisted(() => vi.fn(async () => null));
const applyToJobMock = vi.hoisted(() => vi.fn());
const withdrawApplicationMock = vi.hoisted(() => vi.fn());

vi.mock("../catalog/jobs-api.js", () => ({
  findApprovedJobInCache: (id) => cache.get(String(id)) ?? null,
  loadApprovedJob: (...args) => loadApprovedJobMock(...args),
}));

vi.mock("./apply-api.js", async () => {
  const actual = await vi.importActual("./apply-api.js");
  return {
    ...actual,
    applyToJob: (...args) => applyToJobMock(...args),
    withdrawApplication: (...args) => withdrawApplicationMock(...args),
    loadMyApplication: (...args) => loadMyApplicationMock(...args),
  };
});

import { JobDetailRoute } from "./JobDetailRoute.jsx";

function jobRow(id, title) {
  return {
    id,
    title,
    company: "Nuvem Lauro Demo",
    logo: "NL",
    color: "#1e40af",
    level: "Pleno",
    place: "Brasil · Remoto",
    type: "Remoto",
    posted: "há 2 dias",
    stack: ["React"],
    salary: "A combinar",
    description: "Fictícia",
    about: "Empresa fictícia",
    responsibilities: ["Construir interfaces"],
  };
}

const CANDIDATE = {
  logged: true,
  userId: "u1",
  needsOnboarding: false,
  authReady: true,
  profile: {
    full_name: "Ana Demo",
    role: "candidate",
    skills: ["React"],
    preferences: { experience_level: "mid", work_model: "remote", location: "Brasil" },
  },
};

function Jump({ to }) {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(to)}>Ir para outra vaga</button>;
}

function renderRoute(path, props, jumpTo) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      {jumpTo ? <Jump to={jumpTo} /> : null}
      <Routes>
        <Route path="/jobs/:id" element={<JobDetailRoute {...props} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("JobDetailRoute", () => {
  beforeEach(() => {
    cache.clear();
    loadApprovedJobMock.mockReset();
    loadMyApplicationMock.mockReset();
    loadMyApplicationMock.mockResolvedValue(null);
    applyToJobMock.mockReset();
    withdrawApplicationMock.mockReset();
  });

  it("com cache parcial, falha de rede mantém a vaga e não parece 404", async () => {
    cache.set("1", jobRow("1", "Pessoa Desenvolvedora Front-end"));
    loadApprovedJobMock.mockRejectedValue(new Error("network"));
    renderRoute("/jobs/1", { logged: false, authReady: true, needsOnboarding: false, profile: null });
    expect(await screen.findByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/Não foi possível atualizar os detalhes/i);
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    expect(screen.queryByText("Vaga não encontrada.")).not.toBeInTheDocument();
  });

  it("falha de rede sem cache mostra erro com retry, não 404", async () => {
    loadApprovedJobMock.mockRejectedValue(new Error("network"));
    renderRoute("/jobs/missing", { logged: false, authReady: true, needsOnboarding: false, profile: null });
    expect(await screen.findByRole("alert")).toHaveTextContent(/Não foi possível carregar esta vaga/i);
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    expect(screen.queryByText("Vaga não encontrada.")).not.toBeInTheDocument();
  });

  it("apply lento na vaga A não grava status na vaga B após navegar", async () => {
    loadApprovedJobMock.mockImplementation(async (id) => jobRow(
      id,
      String(id) === "2" ? "Desenvolvedor(a) Back-end Node.js" : "Pessoa Desenvolvedora Front-end",
    ));
    let resolveApply;
    applyToJobMock.mockImplementation(() => new Promise((resolve) => {
      resolveApply = resolve;
    }));

    renderRoute("/jobs/1", CANDIDATE, "/jobs/2");
    fireEvent.click(await screen.findByRole("button", { name: /Candidatar-se com 1 clique/i }));
    await vi.waitFor(() => expect(applyToJobMock).toHaveBeenCalledWith("1"));

    fireEvent.click(screen.getByRole("button", { name: "Ir para outra vaga" }));
    expect(await screen.findByRole("heading", { name: "Desenvolvedor(a) Back-end Node.js" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Candidatar-se com 1 clique/i })).toBeInTheDocument();

    await act(async () => {
      resolveApply({ status: "submitted" });
    });
    expect(screen.queryByText("Candidatura enviada!")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Candidatar-se com 1 clique/i })).toBeInTheDocument();
  });
});
