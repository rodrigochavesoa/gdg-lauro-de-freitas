import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminChildRoutes } from "./features/admin/admin-routes.jsx";

const loadCurationProfile = vi.hoisted(() => vi.fn(async () => null));
const loadAdminDashboardSummary = vi.hoisted(() =>
  vi.fn(async () => ({
    pendingCuration: 0,
    approved: 0,
    rejectedJobs: 0,
    rejectedQueue: 0,
    pendingJobs: 0,
    ingestAttention: 0,
  })),
);
const loadAdminJobs = vi.hoisted(() => vi.fn(async () => []));
const loadAdminJob = vi.hoisted(() => vi.fn(async () => null));
const signInCuration = vi.hoisted(() => vi.fn());
const CurationQueueMock = vi.hoisted(() => vi.fn());
const staffMfa = vi.hoisted(() => ({
  required: false,
  getStaffMfaAssurance: vi.fn(),
  enrollStaffTotp: vi.fn(),
  verifyStaffTotp: vi.fn(),
}));

vi.mock("./features/curation/curation-api.js", () => ({
  loadCurationProfile: (...args) => loadCurationProfile(...args),
  signInCuration: (...args) => signInCuration(...args),
}));

vi.mock("./features/admin/admin-dashboard-api.js", () => ({
  loadAdminDashboardSummary: (...args) => loadAdminDashboardSummary(...args),
}));

vi.mock("./lib/admin-api.js", async () => {
  const actual = await vi.importActual("./lib/admin-api.js");
  return {
    ...actual,
    createPendingJob: vi.fn(),
    loadAdminJobs: (...args) => loadAdminJobs(...args),
    loadAdminJob: (...args) => loadAdminJob(...args),
    loadCompanies: vi.fn(async () => []),
    updatePendingJob: vi.fn(),
  };
});

vi.mock("./features/curation/CurationQueue.jsx", () => ({
  CurationQueue: (props) => {
    CurationQueueMock(props);
    return <div data-testid="curation-queue" />;
  },
}));

vi.mock("./features/ingest/IngestPanel.jsx", () => ({
  IngestPanel: () => <div data-testid="ingest-panel" />,
}));

vi.mock("./features/auth/staff-mfa.js", async () => {
  const actual = await vi.importActual("./features/auth/staff-mfa.js");
  return {
    ...actual,
    isStaffMfaRequired: () => staffMfa.required,
    needsStaffMfaStep: (assurance) => Boolean(assurance) && assurance.currentLevel !== "aal2",
    getStaffMfaAssurance: (...args) => staffMfa.getStaffMfaAssurance(...args),
    enrollStaffTotp: (...args) => staffMfa.enrollStaffTotp(...args),
    verifyStaffTotp: (...args) => staffMfa.verifyStaffTotp(...args),
  };
});

import { Admin } from "./Admin.jsx";

function renderAdmin(ui, { path = "/admin" } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={ui}>
          {adminChildRoutes}
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const adminSession = { user: { id: "a1", email: "ada@example.invalid" } };
const adminProfile = { id: "a1", role: "admin", full_name: "Ada Admin" };

describe("Admin", () => {
  beforeEach(() => {
    loadCurationProfile.mockReset();
    loadCurationProfile.mockResolvedValue(null);
    loadAdminJobs.mockReset();
    loadAdminJobs.mockResolvedValue([]);
    loadAdminJob.mockReset();
    loadAdminJob.mockResolvedValue(null);
    signInCuration.mockReset();
    loadAdminDashboardSummary.mockReset();
    loadAdminDashboardSummary.mockImplementation(async () => ({
      pendingCuration: 0,
      approved: 0,
      rejectedJobs: 0,
      rejectedQueue: 0,
      pendingJobs: 0,
      ingestAttention: 0,
    }));
    loadAdminJobs.mockReset();
    loadAdminJobs.mockResolvedValue([]);
    CurationQueueMock.mockClear();
    staffMfa.required = false;
    staffMfa.getStaffMfaAssurance.mockReset();
    staffMfa.getStaffMfaAssurance.mockResolvedValue({
      currentLevel: "aal2",
      nextLevel: "aal2",
      verifiedTotp: [{ id: "totp-1", status: "verified" }],
    });
    staffMfa.enrollStaffTotp.mockReset();
    staffMfa.enrollStaffTotp.mockResolvedValue({
      factorId: "factor-1",
      qrCode: "data:image/svg+xml,<svg></svg>",
      secret: "SECRETBASE32",
    });
    staffMfa.verifyStaffTotp.mockReset();
    staffMfa.verifyStaffTotp.mockResolvedValue({});
  });

  it("usa admin-auth-form compacto, sem job-form do CRUD", async () => {
    renderAdmin(<Admin session={null} authReady />);
    expect(await screen.findByRole("heading", { name: "Entrar para curadoria ou admin" })).toBeInTheDocument();
    const form = document.querySelector("form.admin-auth-form");
    expect(form).toBeTruthy();
    expect(form).not.toHaveClass("job-form");
    expect(document.querySelector(".admin-side")).toBeNull();
    expect(document.querySelector(".admin-auth-shell")).toBeTruthy();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("id", "admin-email");
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("name", "email");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("id", "admin-password");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("name", "password");
    expect(screen.getByText(/Use o e-mail e a senha da sua conta de equipe GDG Jobs/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Login" })).toHaveAttribute("href", "/login");
    expect(screen.getByPlaceholderText("seu-email@empresa.com")).toBeInTheDocument();
    expect(screen.queryByText(/conta de teste/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/homolog/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/example\.invalid/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sprint 5/i)).not.toBeInTheDocument();
    expect(loadCurationProfile).not.toHaveBeenCalled();
  });

  it("anon em deep link /admin/curadoria permanece no login staff", async () => {
    renderAdmin(<Admin session={null} authReady />, { path: "/admin/curadoria" });
    expect(await screen.findByRole("heading", { name: "Entrar para curadoria ou admin" })).toBeInTheDocument();
    expect(screen.queryByTestId("curation-queue")).not.toBeInTheDocument();
  });

  it("staff com authProfile no snapshot vê o painel e navega sem buscar perfil de curadoria", async () => {
    loadCurationProfile.mockImplementation(() => new Promise(() => {}));
    renderAdmin(
      <Admin authReady session={adminSession} authProfile={adminProfile} />,
    );
    expect(screen.getByRole("heading", { name: "Painel" })).toBeInTheDocument();
    expect(within(document.querySelector(".admin-tabs")).getByRole("link", { name: "Publicar" })).toHaveAttribute("href", "/admin/vagas/nova");
    expect(screen.getByRole("link", { name: "Curadoria" })).toHaveAttribute("href", "/admin/curadoria");
    expect(screen.getByRole("link", { name: "Vagas" })).toHaveAttribute("href", "/admin/vagas");
    expect(screen.getByRole("link", { name: "Painel" })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("heading", { name: "Painel" })).toBeInTheDocument();
    expect(within(document.querySelector(".admin-tabs")).getByRole("link", { name: "Ingestão" })).toHaveAttribute(
      "href",
      "/admin/ingestao",
    );
    expect(screen.queryByRole("heading", { name: "Publicar nova vaga" })).not.toBeInTheDocument();
    expect(screen.queryByText("Carregando área administrativa…")).not.toBeInTheDocument();
    expect(loadCurationProfile).not.toHaveBeenCalled();
    expect(screen.queryByTestId("curation-queue")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Curadoria" }));
    expect(screen.getByTestId("curation-queue")).toBeInTheDocument();
    fireEvent.click(within(document.querySelector(".admin-tabs")).getByRole("link", { name: "Publicar" }));
    expect(screen.getByRole("heading", { name: "Publicar nova vaga" })).toBeInTheDocument();
    expect(screen.getByLabelText("Título da vaga")).toHaveAttribute("id", "admin-job-title");
    const unnamedJobs = [...document.querySelectorAll("input, select, textarea")].filter((el) => !el.id && !el.name);
    expect(unnamedJobs).toEqual([]);
    fireEvent.click(screen.getByRole("link", { name: "Painel" }));
    expect(screen.queryByRole("link", { name: "Abrir curadoria" })).not.toBeInTheDocument();
    fireEvent.click(within(document.querySelector(".admin-tabs")).getByRole("link", { name: "Ingestão" }));
    expect(screen.getByTestId("ingest-panel")).toBeInTheDocument();
  });

  it("área logada não renderiza sidebar nem card de perfil", async () => {
    loadCurationProfile.mockResolvedValue({
      id: "c1",
      role: "curator",
      full_name: "Cora Curadora",
      email: "curator-homolog@example.invalid",
    });
    renderAdmin(<Admin session={{ user: { id: "c1" } }} authReady />);
    expect(await screen.findByRole("link", { name: "Curadoria" })).toBeInTheDocument();
    expect(document.querySelector(".admin-side")).toBeNull();
    expect(document.querySelector(".admin-user")).toBeNull();
    expect(screen.queryByText("Cora Curadora")).not.toBeInTheDocument();
    const tabs = document.querySelector(".admin-tabs");
    expect(tabs).toBeTruthy();
    expect(within(tabs).queryByRole("link", { name: "Publicar" })).not.toBeInTheDocument();
    expect(within(tabs).queryByRole("link", { name: "Vagas" })).not.toBeInTheDocument();
    expect(within(tabs).queryByRole("link", { name: "Ingestão" })).not.toBeInTheDocument();
  });

  it("curator não amplia acesso em /admin/vagas", async () => {
    renderAdmin(
      <Admin
        authReady
        session={{ user: { id: "c1", email: "cora@example.invalid" } }}
        authProfile={{ id: "c1", role: "curator", full_name: "Cora Curadora" }}
      />,
      { path: "/admin/vagas" },
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/restrita ao papel admin/i);
    expect(screen.queryByRole("heading", { name: "Aguardando curadoria" })).not.toBeInTheDocument();
    expect(loadAdminJobs).not.toHaveBeenCalled();
  });

  it("moderator não amplia acesso em /admin/vagas/nova", async () => {
    renderAdmin(
      <Admin
        authReady
        session={{ user: { id: "m1", email: "mo@example.invalid" } }}
        authProfile={{ id: "m1", role: "moderator", full_name: "Mo Moderadora" }}
      />,
      { path: "/admin/vagas/nova" },
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/restrita ao papel admin/i);
    expect(screen.queryByRole("heading", { name: "Publicar nova vaga" })).not.toBeInTheDocument();
  });

  it("mostra o painel do admin sem esperar o CRUD de vagas", async () => {
    let resolveJobs;
    loadAdminJobs.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveJobs = resolve;
        }),
    );
    loadCurationProfile.mockResolvedValue({
      id: "a1",
      role: "admin",
      full_name: "Ada Admin",
      email: "ada@example.invalid",
    });
    renderAdmin(<Admin session={{ user: { id: "a1" } }} authReady />);
    expect(await screen.findByRole("link", { name: "Publicar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Curadoria" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Painel" })).toBeInTheDocument();
    expect(screen.queryByText("Carregando área administrativa…")).not.toBeInTheDocument();
    expect(screen.queryByText("Pessoa Estagiária (rascunho)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Vagas" }));
    expect(await screen.findByRole("heading", { name: "Gestão de vagas" })).toBeInTheDocument();
    expect(screen.getByText("Carregando vagas da área administrativa…")).toBeInTheDocument();
    resolveJobs([
      {
        id: "j2",
        title: "Pessoa Estagiária (rascunho)",
        status: "pending",
        companies: { name: "Nuvem Lauro Demo" },
      },
    ]);
    expect(await screen.findByRole("link", { name: /Pessoa Estagiária \(rascunho\)/ })).toHaveAttribute(
      "href",
      "/admin/vagas/j2",
    );
  });

  it("admin troca Curadoria e Publicar pelas rotas", async () => {
    loadCurationProfile.mockResolvedValue({
      id: "a1",
      role: "admin",
      full_name: "Ada Admin",
      email: "ada@example.invalid",
    });
    renderAdmin(<Admin session={{ user: { id: "a1" } }} authReady />);
    expect(await screen.findByRole("link", { name: "Publicar" })).toBeInTheDocument();
    expect(document.querySelector(".admin-side")).toBeNull();
    expect(screen.queryByText("Ada Admin")).not.toBeInTheDocument();
    const tabs = document.querySelector(".admin-tabs");
    expect(within(tabs).getByRole("link", { name: "Curadoria" })).toBeInTheDocument();
    expect(within(tabs).getByRole("link", { name: "Publicar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Painel" })).toBeInTheDocument();
    fireEvent.click(within(tabs).getByRole("link", { name: "Publicar" }));
    expect(await screen.findByRole("heading", { name: "Publicar nova vaga" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cadastrar para curadoria" })).toBeInTheDocument();
    fireEvent.click(within(tabs).getByRole("link", { name: "Curadoria" }));
    expect(screen.queryByRole("heading", { name: "Publicar nova vaga" })).not.toBeInTheDocument();
    expect(screen.getByTestId("curation-queue")).toBeInTheDocument();
    fireEvent.click(within(tabs).getByRole("link", { name: "Publicar" }));
    expect(screen.getByRole("heading", { name: "Publicar nova vaga" })).toBeInTheDocument();
    expect(document.querySelector(".job-form .form-actions")).toBeTruthy();
  });

  it("lista pendentes e publicadas em seções separadas na rota de vagas", async () => {
    loadCurationProfile.mockResolvedValue({
      id: "a1",
      role: "admin",
      full_name: "Ada Admin",
      email: "ada@example.invalid",
    });
    loadAdminJobs.mockResolvedValue([
      {
        id: "j1",
        title: "Pessoa Desenvolvedora Front-end",
        status: "approved",
        companies: { name: "Nuvem Lauro Demo" },
      },
      {
        id: "j2",
        title: "Pessoa Estagiária (rascunho)",
        status: "pending",
        companies: { name: "Nuvem Lauro Demo" },
      },
    ]);
    renderAdmin(<Admin session={{ user: { id: "a1" } }} authReady />, { path: "/admin/vagas" });
    expect(await screen.findByRole("link", { name: /Pessoa Estagiária \(rascunho\)/ })).toHaveAttribute(
      "href",
      "/admin/vagas/j2",
    );
    expect(screen.queryByRole("heading", { name: "Vagas pending e approved" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^pending$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^approved$/i)).not.toBeInTheDocument();
    expect(document.querySelector("form.job-form")).toBeNull();

    const pendingSection = screen.getByRole("heading", { name: "Aguardando curadoria" }).closest(".admin-job-list");
    expect(within(pendingSection).getByRole("link", { name: /Pessoa Estagiária \(rascunho\)/ })).toHaveAttribute(
      "href",
      "/admin/vagas/j2",
    );
    expect(within(pendingSection).getByText("Pendente")).toHaveClass("featured");
    expect(within(pendingSection).queryByText("Pessoa Desenvolvedora Front-end")).not.toBeInTheDocument();

    const publishedSection = document.querySelector("details.admin-job-list");
    expect(publishedSection).toBeTruthy();
    expect(publishedSection.open).toBe(false);
    expect(within(publishedSection).getByText("Vagas publicadas")).toBeInTheDocument();
    expect(within(publishedSection).getByText("Publicada")).toHaveClass("featured");
    expect(within(publishedSection).getByText("Pessoa Desenvolvedora Front-end")).toHaveClass("admin-job-list-title");
    expect(within(publishedSection).getByRole("link", { name: /Pessoa Desenvolvedora Front-end/ })).toHaveAttribute(
      "href",
      "/admin/vagas/j1",
    );
    expect(within(publishedSection).getByText("Edite via nova rodada na Curadoria.")).toBeInTheDocument();
  });

  it("abre o detalhe de uma vaga por deep link", async () => {
    loadAdminJob.mockResolvedValue({
      id: "j2",
      title: "Pessoa Estagiária (rascunho)",
      status: "pending",
      companies: { name: "Nuvem Lauro Demo" },
      description: "Rascunho fictício.",
      job_curation_reviews: [],
    });
    renderAdmin(
      <Admin authReady session={adminSession} authProfile={adminProfile} />,
      { path: "/admin/vagas/j2" },
    );
    expect(await screen.findByRole("heading", { name: "Pessoa Estagiária (rascunho)" })).toBeInTheDocument();
    expect(screen.getByText("Rascunho fictício.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Editar rascunho" })).toHaveAttribute(
      "href",
      "/admin/vagas/nova?editar=j2",
    );
  });

  it("lista vagas rejeitadas com histórico de parecer", async () => {
    loadCurationProfile.mockResolvedValue({
      id: "a1",
      role: "admin",
      full_name: "Ada Admin",
      email: "ada@example.invalid",
    });
    loadAdminJobs.mockResolvedValue([
      {
        id: "j3",
        title: "Pessoa Dev rejeitada",
        status: "rejected",
        companies: { name: "Nuvem Lauro Demo" },
        job_curation_reviews: [
          {
            decision: "reject",
            rubric_code: "R3-sem-discriminacao",
            internal_comment: "Texto discriminatório no anúncio fictício.",
            curation_round: 1,
            created_at: "2026-09-15T12:00:00Z",
          },
        ],
      },
    ]);
    renderAdmin(<Admin session={{ user: { id: "a1" } }} authReady />, { path: "/admin/vagas" });
    expect(await screen.findByText("Pessoa Dev rejeitada")).toBeInTheDocument();
    expect(screen.getByText("Vagas rejeitadas")).toBeInTheDocument();
    const rejectedSection = screen.getByText("Vagas rejeitadas").closest("details");
    expect(within(rejectedSection).getByText("Rejeitada")).toHaveClass("featured");
    expect(within(rejectedSection).getByText("Pessoa Dev rejeitada")).toBeInTheDocument();
    expect(within(rejectedSection).getByText(/R3-sem-discriminacao|Sem exigências discriminatórias/)).toBeInTheDocument();
  });

  it("mostra erros de validação visíveis ao cadastrar sem campos obrigatórios", async () => {
    loadCurationProfile.mockResolvedValue({
      id: "a1",
      role: "admin",
      full_name: "Ada Admin",
      email: "ada@example.invalid",
    });
    renderAdmin(<Admin session={{ user: { id: "a1" } }} authReady />, { path: "/admin/vagas/nova" });
    expect(await screen.findByRole("heading", { name: "Publicar nova vaga" })).toBeInTheDocument();
    document.querySelectorAll("[required]").forEach((el) => el.removeAttribute("required"));
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar para curadoria" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveClass("form-alert");
    expect(within(alert).getByText("Título é obrigatório.")).toBeInTheDocument();
    expect(within(alert).getByText("Descrição é obrigatória.")).toBeInTheDocument();
    expect(within(alert).getByText("Selecione uma empresa ou informe o nome de uma empresa fictícia.")).toBeInTheDocument();
    expect(within(alert).getByText("Nível é obrigatório.")).toBeInTheDocument();
  });

  it("anuncia erro acessível quando o carregamento das vagas falha", async () => {
    loadAdminJobs.mockRejectedValue(new Error("Falha ao listar vagas"));
    renderAdmin(
      <Admin authReady session={adminSession} authProfile={adminProfile} />,
      { path: "/admin/vagas" },
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveClass("form-alert");
    expect(alert).toHaveTextContent("Falha ao listar vagas");
    await waitFor(() => {
      expect(screen.queryByText("Nenhuma vaga aguardando curadoria.")).not.toBeInTheDocument();
    });
  });

  it("anuncia falha de login com alerta, não com token de sucesso", async () => {
    signInCuration.mockRejectedValue(new Error("Credenciais inválidas"));
    renderAdmin(<Admin session={null} authReady />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ada@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "wrong-pass" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveClass("form-alert");
    expect(alert).not.toHaveClass("success");
    expect(alert).toHaveTextContent("Credenciais inválidas");
    expect(screen.getByLabelText("E-mail")).toHaveValue("");
    expect(screen.getByLabelText("Senha")).toHaveValue("");
  });

  it("limpa e-mail e senha após login simulado", async () => {
    signInCuration.mockResolvedValue({
      id: "c1",
      role: "curator",
      full_name: "Cora Curadora",
      email: "cora@example.invalid",
    });
    const { rerender } = renderAdmin(<Admin session={null} authReady />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "cora@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "staff-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("link", { name: "Curadoria" })).toBeInTheDocument();
    expect(screen.queryByDisplayValue("staff-secret")).not.toBeInTheDocument();
    rerender(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<Admin session={{ user: { id: "c1" } }} authReady />}>
            {adminChildRoutes}
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    rerender(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<Admin session={null} authReady />}>
            {adminChildRoutes}
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText("E-mail")).toHaveValue("");
    expect(screen.getByLabelText("Senha")).toHaveValue("");
  });

  it("limpa e-mail, senha e erro quando session vira null", async () => {
    signInCuration.mockRejectedValue(new Error("Credenciais inválidas"));
    const { rerender } = renderAdmin(<Admin session={null} authReady />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ada@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "staff-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciais inválidas");
    rerender(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<Admin authReady session={adminSession} authProfile={adminProfile} />}>
            {adminChildRoutes}
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("link", { name: "Publicar" })).toBeInTheDocument();
    rerender(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<Admin session={null} authReady />}>
            {adminChildRoutes}
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText("E-mail")).toHaveValue("");
    expect(screen.getByLabelText("Senha")).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ignora authProfile staff stale quando session já é null", async () => {
    loadCurationProfile.mockImplementation(() => new Promise(() => {}));
    renderAdmin(
      <Admin
        authReady
        session={null}
        authProfile={adminProfile}
      />,
    );
    expect(await screen.findByRole("heading", { name: "Entrar para curadoria ou admin" })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveValue("");
    expect(screen.getByLabelText("Senha")).toHaveValue("");
    expect(screen.queryByRole("link", { name: "Publicar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Curadoria" })).not.toBeInTheDocument();
    expect(loadCurationProfile).not.toHaveBeenCalled();
  });

  it("com flag MFA e AAL2 libera a área admin", async () => {
    staffMfa.required = true;
    renderAdmin(
      <Admin authReady session={adminSession} authProfile={adminProfile} />,
    );
    expect(await screen.findByRole("link", { name: "Publicar" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Confirmar segundo fator" })).not.toBeInTheDocument();
  });

  it("com flag MFA e AAL1 bloqueia a UI até o desafio", async () => {
    staffMfa.required = true;
    staffMfa.getStaffMfaAssurance.mockResolvedValue({
      currentLevel: "aal1",
      nextLevel: "aal2",
      verifiedTotp: [{ id: "totp-1", status: "verified" }],
    });
    renderAdmin(
      <Admin authReady session={adminSession} authProfile={adminProfile} />,
      { path: "/admin/vagas/nova" },
    );
    expect(await screen.findByRole("heading", { name: "Confirmar segundo fator" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/código de 6 dígitos do autenticador/);
    expect(screen.getByLabelText("Código do autenticador")).toBeInTheDocument();
    expect(screen.getByLabelText("Código do autenticador")).toHaveAttribute("id", "admin-totp");
    expect(screen.getByLabelText("Código do autenticador")).toHaveAttribute("name", "totp");
    expect(screen.queryByRole("link", { name: "Publicar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Curadoria" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Publicar nova vaga" })).not.toBeInTheDocument();
  });

  it("staff sem fator inscrito vê enroll TOTP e só entra após verify", async () => {
    staffMfa.required = true;
    staffMfa.getStaffMfaAssurance.mockResolvedValue({
      currentLevel: "aal1",
      nextLevel: "aal1",
      verifiedTotp: [],
    });
    signInCuration.mockResolvedValue({
      id: "c1",
      role: "curator",
      full_name: "Cora Curadora",
      email: "cora@example.invalid",
    });
    renderAdmin(<Admin session={null} authReady />, { path: "/admin/curadoria" });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "cora@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "staff-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("heading", { name: "Confirmar segundo fator" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Curadoria" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Gerar QR do autenticador" }));
    const qr = await screen.findByAltText("QR code do autenticador");
    expect(qr.tagName).toBe("IMG");
    expect(qr).toHaveAttribute("src", "data:image/svg+xml,<svg></svg>");
    expect(document.querySelector(".admin-mfa-qr[aria-hidden]")).toBeNull();
    expect(screen.getByText(/SECRETBASE32/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Código do autenticador"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar código" }));
    expect(await screen.findByRole("link", { name: "Curadoria" })).toBeInTheDocument();
    expect(screen.getByTestId("curation-queue")).toBeInTheDocument();
    expect(staffMfa.verifyStaffTotp).toHaveBeenCalledWith({ factorId: "factor-1", code: "123456" });
  });

  it("limpa o passo MFA pendente quando a sessão vira null", async () => {
    staffMfa.required = true;
    staffMfa.getStaffMfaAssurance.mockResolvedValue({
      currentLevel: "aal1",
      nextLevel: "aal2",
      verifiedTotp: [{ id: "totp-1", status: "verified" }],
    });
    const { rerender } = renderAdmin(
      <Admin authReady session={adminSession} authProfile={adminProfile} />,
    );
    expect(await screen.findByLabelText("Código do autenticador")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Código do autenticador"), { target: { value: "123456" } });
    rerender(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<Admin session={null} authReady />}>
            {adminChildRoutes}
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "Entrar para curadoria ou admin" })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveValue("");
    expect(screen.getByLabelText("Senha")).toHaveValue("");
    expect(screen.queryByLabelText("Código do autenticador")).not.toBeInTheDocument();
  });
});
