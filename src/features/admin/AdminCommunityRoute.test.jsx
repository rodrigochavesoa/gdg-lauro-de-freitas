import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const communityApi = vi.hoisted(() => ({
  listCommunityProfiles: vi.fn(),
  loadCommunityProfile: vi.fn(),
  loadMyCommunityPublicationStatus: vi.fn(),
  setMyCommunityPublication: vi.fn(),
  getCommunityAvatarObjectUrl: vi.fn(),
  prefetchCommunityAvatars: vi.fn(),
  peekCommunityAvatarObjectUrl: vi.fn(() => null),
  revokeCommunityAvatarObjectUrls: vi.fn(),
}));

vi.mock("../community/community-api.js", () => ({
  listCommunityProfiles: communityApi.listCommunityProfiles,
  loadCommunityProfile: communityApi.loadCommunityProfile,
  loadMyCommunityPublicationStatus: communityApi.loadMyCommunityPublicationStatus,
  setMyCommunityPublication: communityApi.setMyCommunityPublication,
  getCommunityAvatarObjectUrl: communityApi.getCommunityAvatarObjectUrl,
  prefetchCommunityAvatars: communityApi.prefetchCommunityAvatars,
  peekCommunityAvatarObjectUrl: communityApi.peekCommunityAvatarObjectUrl,
  revokeCommunityAvatarObjectUrls: communityApi.revokeCommunityAvatarObjectUrls,
}));

import { AdminCommunityRoute } from "./AdminCommunityRoute.jsx";
import { AdminNav } from "./AdminNav.jsx";

const member = {
  publicId: "community-member-1",
  fullName: "Ana da Comunidade",
  headline: "Desenvolvedora",
  skills: ["React"],
  location: "Salvador",
  experienceLevel: "mid",
  workModel: "remote",
  avatarAvailable: false,
  bio: "Perfil de homologação",
  preferences: {},
};

function StaffShell({ role }) {
  const profile = { id: `staff-${role}`, role };
  const session = { user: { id: profile.id } };
  return (
    <main id="conteudo">
      <AdminNav profile={profile} />
      <section className="admin-content"><Outlet context={{ profile, session }} /></section>
    </main>
  );
}

function renderAdminCommunity(role = "admin", route = "/admin/comunidade") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/admin" element={<StaffShell role={role} />}>
          <Route path="comunidade" element={<AdminCommunityRoute />} />
          <Route path="comunidade/:publicId" element={<AdminCommunityRoute />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminCommunityRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    communityApi.listCommunityProfiles.mockResolvedValue({ items: [member], nextCursor: null });
    communityApi.loadCommunityProfile.mockResolvedValue(member);
    communityApi.prefetchCommunityAvatars.mockResolvedValue(undefined);
    communityApi.peekCommunityAvatarObjectUrl.mockReturnValue(null);
  });

  it.each(["admin", "curator", "moderator"])("mantém %s no fluxo da Comunidade dentro do shell admin", async (role) => {
    renderAdminCommunity(role);
    expect(await screen.findByRole("heading", { name: "Profissionais da comunidade" })).toBeInTheDocument();
    expect(document.querySelectorAll("main#conteudo")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Comunidade" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Ver perfil de Ana da Comunidade" })).toHaveAttribute(
      "href",
      "/admin/comunidade/community-member-1",
    );
    expect(communityApi.loadMyCommunityPublicationStatus).not.toHaveBeenCalled();
    expect(screen.queryByRole("checkbox", { name: /quero compartilhar meu perfil/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Ver perfil de Ana da Comunidade" }));
    expect(await screen.findByRole("heading", { name: "Ana da Comunidade", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar à Comunidade" })).toHaveAttribute("href", "/admin/comunidade");
    expect(screen.getByRole("link", { name: "Comunidade" })).toHaveAttribute("aria-current", "page");
  });
});
