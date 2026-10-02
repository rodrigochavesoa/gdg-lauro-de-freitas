import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityRoute } from "./Community.jsx";

const api = vi.hoisted(() => ({
  listCommunityProfiles: vi.fn(),
  loadCommunityProfile: vi.fn(),
  loadMyCommunityPublicationStatus: vi.fn(),
  setMyCommunityPublication: vi.fn(),
  loadCommunityAvatar: vi.fn(),
}));

vi.mock("./community-api.js", () => api);

function renderCommunity({ auth, authReady = true, route = "/comunidade" }) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/comunidade" element={<CommunityRoute auth={auth} authReady={authReady} />} />
        <Route path="/comunidade/:publicId" element={<CommunityRoute auth={auth} authReady={authReady} />} />
        <Route path="/login" element={<h1>Entrar</h1>} />
        <Route path="/onboarding" element={<h1>Completar perfil</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

function communityTree(auth) {
  return (
    <MemoryRouter initialEntries={["/comunidade"]}>
      <Routes>
        <Route path="/comunidade" element={<CommunityRoute auth={auth} authReady />} />
        <Route path="/login" element={<h1>Entrar</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

const authenticatedAuth = {
  session: { user: { id: "user-a" } },
  profile: { role: "candidate" },
  needsOnboarding: false,
};

describe("CommunityRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.loadMyCommunityPublicationStatus.mockResolvedValue({
      published: false,
      canPublish: false,
      reasonCode: "approval_pending",
    });
    api.listCommunityProfiles.mockResolvedValue({ items: [], nextCursor: null });
    api.loadCommunityProfile.mockResolvedValue(null);
    api.setMyCommunityPublication.mockImplementation(async (enabled) => enabled);
    api.loadCommunityAvatar.mockResolvedValue(new Blob(["image"], { type: "image/jpeg" }));
  });

  it("does not request community data until auth is hydrated", () => {
    renderCommunity({ auth: { session: null }, authReady: false });
    expect(document.querySelector(".community-skeleton--page")).toBeTruthy();
    expect(screen.queryByText("Carregando conta…")).not.toBeInTheDocument();
    expect(api.loadMyCommunityPublicationStatus).not.toHaveBeenCalled();
    expect(api.listCommunityProfiles).not.toHaveBeenCalled();
  });

  it("redirects visitors to login without making any community request", () => {
    renderCommunity({ auth: { session: null } });
    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    expect(api.loadMyCommunityPublicationStatus).not.toHaveBeenCalled();
    expect(api.listCommunityProfiles).not.toHaveBeenCalled();
    expect(api.loadCommunityProfile).not.toHaveBeenCalled();
    expect(api.loadCommunityAvatar).not.toHaveBeenCalled();
  });

  it("fails closed while F-11 is pending and does not load profiles or photos", async () => {
    renderCommunity({ auth: authenticatedAuth });
    expect(await screen.findByRole("heading", { name: "Compartilhamento ainda não disponível" })).toBeInTheDocument();
    expect(screen.getByText(/opcional e visível somente a membros autenticados/i)).toBeInTheDocument();
    expect(screen.getByText(/Ao retirar a autorização ou excluir a conta/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /finalidades e os registros de privacidade/i })).toHaveAttribute("href", "/preferencias");
    expect(api.loadMyCommunityPublicationStatus).toHaveBeenCalledTimes(1);
    expect(api.listCommunityProfiles).not.toHaveBeenCalled();
    expect(api.loadCommunityAvatar).not.toHaveBeenCalled();
  });

  it("loads an allowlisted member card and retrieves its avatar only through the proxy", async () => {
    api.loadMyCommunityPublicationStatus.mockResolvedValue({ published: false, canPublish: true, reasonCode: null });
    api.listCommunityProfiles.mockResolvedValue({
      items: [{
        publicId: "2e2fbaf7-e292-4c5d-8b77-928639845e01",
        fullName: "Ana Example",
        headline: "Desenvolvedora Front-end",
        skills: ["React", "CSS"],
        location: "Salvador, BA",
        experienceLevel: "junior",
        workModel: "remote",
        avatarAvailable: true,
        publishedAt: "2026-10-01T12:00:00.000Z",
      }],
      nextCursor: null,
    });
    renderCommunity({ auth: authenticatedAuth });

    expect(await screen.findByRole("heading", { name: "Encontre sua próxima conexão em tech." })).toBeInTheDocument();
    expect(document.querySelector(".hero.community-browse-hero")).toBeTruthy();
    expect(document.querySelector(".home-divider__curve")).toBeTruthy();
    expect(document.querySelector(".community-browse-searchbox")).toBeTruthy();
    expect(screen.getByRole("button", { name: /filtros/i })).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: /filtros/i }));
    expect(screen.getByRole("button", { name: /filtros/i })).toHaveAttribute("aria-expanded", "true");
    const searchInput = screen.getByRole("searchbox", { name: "Nome, tecnologia ou área de atuação" });
    fireEvent.change(searchInput, { target: { value: "React" } });
    fireEvent.click(screen.getByRole("button", { name: /buscar profissionais/i }));
    expect(await screen.findByText("Ana Example")).toBeInTheDocument();
    expect(screen.getByText(/visível para os membros autenticados da Comunidade/i)).toBeInTheDocument();
    expect(screen.getByText(/E-mail, telefone, currículo e dados privados da conta não aparecem/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /preferências de privacidade/i }).length).toBeGreaterThan(0);
    expect(api.loadCommunityAvatar).toHaveBeenCalledWith("2e2fbaf7-e292-4c5d-8b77-928639845e01");
    expect(screen.getByRole("checkbox", { name: /quero compartilhar meu perfil/i })).not.toBeChecked();
    expect(screen.getByRole("link", { name: "Ver perfil de Ana Example" })).toHaveAttribute(
      "href",
      "/comunidade/2e2fbaf7-e292-4c5d-8b77-928639845e01",
    );
    expect(screen.getByRole("link", { name: "Ver perfil" })).toHaveClass("primary", "community-person-card__cta");
  });

  it("shows card-shaped shimmer, not visible loading copy, while the list request is pending", async () => {
    let resolveList;
    api.loadMyCommunityPublicationStatus.mockResolvedValue({ published: false, canPublish: true, reasonCode: null });
    api.listCommunityProfiles.mockReturnValue(new Promise((resolve) => { resolveList = resolve; }));
    renderCommunity({ auth: authenticatedAuth });

    expect(await screen.findByRole("heading", { name: "Escolha se quer aparecer na Comunidade" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /quero compartilhar meu perfil/i })).toBeInTheDocument();
    expect(document.querySelector(".community-results--loading")).toBeTruthy();
    expect(document.querySelectorAll(".community-person-card.community-skeleton-card")).toHaveLength(0);
    expect(document.querySelector(".community-skeleton--page")).not.toBeInTheDocument();
    expect(screen.queryByText("Carregando comunidade…")).not.toBeInTheDocument();

    resolveList({ items: [], nextCursor: null });
    expect(await screen.findByRole("heading", { name: "Profissionais da comunidade" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A comunidade está começando", level: 3 })).toBeInTheDocument();
  });

  it("after opt-in, hides the share onboarding panel and shows discovery", async () => {
    api.loadMyCommunityPublicationStatus.mockResolvedValue({ published: false, canPublish: true, reasonCode: null });
    renderCommunity({ auth: authenticatedAuth });
    const toggle = await screen.findByRole("checkbox", { name: /quero compartilhar meu perfil/i });

    fireEvent.click(toggle);
    await waitFor(() => expect(api.setMyCommunityPublication).toHaveBeenCalledWith(true));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Escolha se quer aparecer na Comunidade" })).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Profissionais da comunidade" })).toBeInTheDocument();
    expect(screen.getByText(/seu perfil está visível/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /gerenciar compartilhamento/i })).toHaveAttribute("href", "/preferencias");
  });

  it("loads discovery without the onboarding panel when already published", async () => {
    api.loadMyCommunityPublicationStatus.mockResolvedValue({ published: true, canPublish: true, reasonCode: null });
    renderCommunity({ auth: authenticatedAuth });
    expect(await screen.findByRole("heading", { name: "Profissionais da comunidade" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Escolha se quer aparecer na Comunidade" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /quero compartilhar meu perfil/i })).not.toBeInTheDocument();
  });

  it("remove os dados renderizados ao sair da sessão sem reutilizá-los no visitante", async () => {
    api.loadMyCommunityPublicationStatus.mockResolvedValue({ published: false, canPublish: true, reasonCode: null });
    api.listCommunityProfiles.mockResolvedValue({
      items: [{
        publicId: "2e2fbaf7-e292-4c5d-8b77-928639845e01",
        fullName: "Ana Example",
        headline: null,
        skills: [],
        location: null,
        experienceLevel: null,
        workModel: null,
        avatarAvailable: false,
        publishedAt: "2026-10-01T12:00:00.000Z",
      }],
      nextCursor: null,
    });
    const view = render(communityTree(authenticatedAuth));
    expect(await screen.findByText("Ana Example")).toBeInTheDocument();

    view.rerender(communityTree({ session: null }));

    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.queryByText("Ana Example")).not.toBeInTheDocument();
  });
});
