import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrivacyPreferences } from "./PrivacyPreferences.jsx";

const {
  loadPrivacyPreferences,
  peekPrivacyPreferencesCache,
  recordPrivacyNotice,
  saveOptionalChoice,
  revokePurpose,
} = vi.hoisted(() => ({
  loadPrivacyPreferences: vi.fn(),
  peekPrivacyPreferencesCache: vi.fn(() => null),
  recordPrivacyNotice: vi.fn(),
  saveOptionalChoice: vi.fn(),
  revokePurpose: vi.fn(),
}));

vi.mock("./privacy-api.js", () => ({
  groupCurrentPrivacyEvents: (events) => events.reduce((result, event) => {
    if (!result[event.purpose_code]) result[event.purpose_code] = event;
    return result;
  }, {}),
  loadPrivacyPreferences,
  peekPrivacyPreferencesCache,
  recordPrivacyNotice,
  saveOptionalChoice,
  revokePurpose,
}));

const purposes = [
  {
    purpose_code: "F-01", version: 1, title: "Criar e proteger sua conta", specific_description: "Conta.",
    classification: "necessary_notice", status: "active", legal_basis_status: "pending_dpo", retention_status: "pending_dpo",
    text_status: "pending_dpo", revocation_effect: "A conta continua protegida.",
  },
  {
    purpose_code: "F-05", version: 1, title: "Receber a GDG Jobs Letter", specific_description: "Newsletter.",
    classification: "optional_consent", status: "inactive", legal_basis_status: "pending_dpo", retention_status: "pending_dpo",
    text_status: "pending_dpo", revocation_effect: "Novos envios param.",
  },
  {
    purpose_code: "F-06", version: 1, title: "Receber recomendações com base no perfil", specific_description: "Recomendações.",
    classification: "optional_consent", status: "active", legal_basis_status: "pending_dpo", retention_status: "pending_dpo",
    text_status: "pending_dpo", revocation_effect: "O catálogo continua.",
  },
];

function renderPage(events = [], { cached } = {}) {
  const payload = { purposes, events, source: "supabase" };
  peekPrivacyPreferencesCache.mockReturnValue(cached ? payload : null);
  loadPrivacyPreferences.mockResolvedValue(payload);
  return render(<MemoryRouter><PrivacyPreferences userId="u1" /></MemoryRouter>);
}

describe("PrivacyPreferences", () => {
  afterEach(() => {
    vi.clearAllMocks();
    peekPrivacyPreferencesCache.mockReturnValue(null);
  });

  it("mostra avisos necessários sem checkbox opcional e deixa escolhas desmarcadas", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Suas preferências de privacidade" })).toBeInTheDocument();
    expect(await screen.findByText("Necessário")).toBeInTheDocument();
    expect(screen.getByText("Em preparação. Esta finalidade não está disponível para escolha.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Desativada" })).not.toBeChecked();
    expect(screen.getAllByText("pending_dpo").length).toBeGreaterThan(0);
  });

  it("registra aceite explícito da finalidade opcional", async () => {
    saveOptionalChoice.mockResolvedValue({});
    renderPage();

    const checkbox = await screen.findByRole("checkbox", { name: "Desativada" });
    fireEvent.click(checkbox);
    await waitFor(() => expect(saveOptionalChoice).toHaveBeenCalledWith("F-06", true));
  });

  it("registra recusa explícita e mantém a finalidade opcional desligada", async () => {
    saveOptionalChoice.mockResolvedValue({});
    renderPage([{
      id: "event-1",
      purpose_code: "F-06",
      purpose_version: 1,
      event_type: "accepted",
      created_at: "2026-09-13T10:00:00Z",
    }]);

    const checkbox = await screen.findByRole("checkbox", { name: "Ativada" });
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    await waitFor(() => expect(saveOptionalChoice).toHaveBeenCalledWith("F-06", false));
  });

  it("exibe histórico mínimo e permite revogar uma escolha aceita", async () => {
    revokePurpose.mockResolvedValue({});
    renderPage([{ id: "event-1", purpose_code: "F-06", purpose_version: 1, event_type: "accepted", created_at: "2026-09-13T10:00:00Z" }]);

    expect(await screen.findByRole("checkbox", { name: "Ativada" })).toBeChecked();
    expect(screen.getByText(/Histórico desta finalidade/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revogar" }));
    await waitFor(() => expect(revokePurpose).toHaveBeenCalledWith("F-06"));
  });

  it("mostra skeleton no cold miss sem gate de texto Carregando", async () => {
    let resolveLoad;
    peekPrivacyPreferencesCache.mockReturnValue(null);
    loadPrivacyPreferences.mockImplementation(
      () => new Promise((resolve) => { resolveLoad = resolve; }),
    );
    render(<MemoryRouter><PrivacyPreferences userId="u1" /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Suas preferências de privacidade" })).toBeInTheDocument();
    expect(document.querySelectorAll(".privacy-card.job-card--skeleton-static")).toHaveLength(3);
    expect(screen.queryByText("Carregando suas preferências…")).not.toBeInTheDocument();
    expect(loadPrivacyPreferences).toHaveBeenCalledWith({ userId: "u1", forceRefresh: false });
    resolveLoad({ purposes, events: [], source: "supabase" });
    expect(await screen.findByText("Necessário")).toBeInTheDocument();
    expect(document.querySelector(".privacy-card.job-card--skeleton-static")).toBeNull();
  });

  it("reusa o cache no remount e não mostra skeleton nem loading", async () => {
    renderPage([], { cached: true });
    expect(screen.getByText("Necessário")).toBeInTheDocument();
    expect(document.querySelector(".privacy-card.job-card--skeleton-static")).toBeNull();
    expect(screen.queryByText("Carregando suas preferências…")).not.toBeInTheDocument();
    expect(loadPrivacyPreferences).toHaveBeenCalledWith({ userId: "u1", forceRefresh: true });
  });
});
