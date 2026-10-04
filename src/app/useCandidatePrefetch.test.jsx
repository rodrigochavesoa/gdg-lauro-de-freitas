import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadMyApplicationsMock, loadPrivacyPreferencesMock } = vi.hoisted(() => ({
  loadMyApplicationsMock: vi.fn(async () => ({ applications: [] })),
  loadPrivacyPreferencesMock: vi.fn(async () => ({ purposes: [], events: [] })),
}));

vi.mock("../features/jobs/apply-api.js", () => ({
  loadMyApplications: (...args) => loadMyApplicationsMock(...args),
}));
vi.mock("../features/privacy/privacy-api.js", () => ({
  loadPrivacyPreferences: (...args) => loadPrivacyPreferencesMock(...args),
}));

import { useCandidatePrefetch } from "./useCandidatePrefetch.js";

function Harness({ userId = "candidate-1", role = "candidate", needsOnboarding = false }) {
  const { prefetchApplications, prefetchPrivacy } = useCandidatePrefetch({ userId, role, needsOnboarding });
  return (
    <>
      <button type="button" onMouseEnter={prefetchApplications} onFocus={prefetchApplications}>Candidaturas</button>
      <button type="button" onMouseEnter={prefetchPrivacy} onFocus={prefetchPrivacy}>Preferências</button>
    </>
  );
}

describe("useCandidatePrefetch", () => {
  beforeEach(() => {
    loadMyApplicationsMock.mockClear();
    loadPrivacyPreferencesMock.mockClear();
  });

  it("não dispara requests privados até haver intenção nos links", () => {
    render(<Harness />);
    expect(loadMyApplicationsMock).not.toHaveBeenCalled();
    expect(loadPrivacyPreferencesMock).not.toHaveBeenCalled();

    fireEvent.focus(screen.getByRole("button", { name: "Candidaturas" }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Preferências" }));
    expect(loadMyApplicationsMock).toHaveBeenCalledWith({ userId: "candidate-1" });
    expect(loadPrivacyPreferencesMock).toHaveBeenCalledWith({ userId: "candidate-1" });
  });

  it.each([
    ["anônimo", { userId: null, role: null, needsOnboarding: false }],
    ["staff", { userId: "staff-1", role: "admin", needsOnboarding: false }],
    ["perfil em onboarding", { userId: "candidate-1", role: "candidate", needsOnboarding: true }],
  ])("não busca dados privados para %s", (_description, props) => {
    render(<Harness {...props} />);
    fireEvent.focus(screen.getByRole("button", { name: "Candidaturas" }));
    fireEvent.focus(screen.getByRole("button", { name: "Preferências" }));
    expect(loadMyApplicationsMock).not.toHaveBeenCalled();
    expect(loadPrivacyPreferencesMock).not.toHaveBeenCalled();
  });
});
