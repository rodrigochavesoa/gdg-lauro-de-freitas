import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const supabaseState = vi.hoisted(() => ({
  listeners: [],
  from: vi.fn(),
  getUser: vi.fn(),
  getSession: vi.fn(),
}));

const loadCurationProfile = vi.hoisted(() => vi.fn(async () => null));
const signInCuration = vi.hoisted(() => vi.fn());
const profileMode = vi.hoisted(() => ({ value: "fail" }));

vi.mock("./lib/supabase-client.js", () => ({
  getSupabaseBrowserClient: () => ({
    from: supabaseState.from,
    auth: {
      getSession: supabaseState.getSession,
      getUser: supabaseState.getUser,
      onAuthStateChange: (callback) => {
        supabaseState.listeners.push(callback);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signOut: vi.fn(async () => ({ error: null })),
    },
  }),
}));

vi.mock("./features/curation/curation-api.js", async () => {
  const actual = await vi.importActual("./features/curation/curation-api.js");
  return {
    ...actual,
    loadCurationProfile: (...args) => loadCurationProfile(...args),
    signInCuration: (...args) => signInCuration(...args),
  };
});

vi.mock("./features/auth/staff-mfa.js", async () => {
  const actual = await vi.importActual("./features/auth/staff-mfa.js");
  return {
    ...actual,
    isStaffMfaRequired: () => false,
  };
});

vi.mock("./features/admin/admin-dashboard-api.js", () => ({
  loadAdminDashboardJobCounts: vi.fn(async () => ({
    pendingCuration: 0,
    approved: 0,
    rejectedJobs: 0,
    rejectedQueue: 0,
    pendingJobs: 0,
  })),
  countIngestionsNeedingAttention: vi.fn(async () => 0),
}));

import { App } from "./App.jsx";

const session = {
  user: {
    id: "a1",
    email: "ada@example.invalid",
    user_metadata: { full_name: "Ada Admin" },
  },
  access_token: "t1",
};

const staffProfile = {
  id: "a1",
  full_name: "Ada Admin",
  role: "admin",
  skills: [],
  preferences: {},
  headline: null,
  bio: null,
  avatar_path: null,
};

function emitAuth(event, nextSession) {
  for (const listener of [...supabaseState.listeners]) listener(event, nextSession);
}

describe("App → subscribeAuth → Admin", () => {
  beforeEach(() => {
    supabaseState.listeners = [];
    profileMode.value = "fail";
    loadCurationProfile.mockClear();
    signInCuration.mockReset();
    supabaseState.getUser.mockReset();
    supabaseState.getSession.mockReset();
    supabaseState.from.mockReset();
    supabaseState.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (profileMode.value === "fail") {
              return { data: null, error: { message: "timeout" } };
            }
            return { data: staffProfile, error: null };
          },
        }),
      }),
      upsert: async () => ({ error: null }),
    }));
    signInCuration.mockImplementation(async () => {
      profileMode.value = "ok";
      emitAuth("SIGNED_IN", session);
      return {
        id: "a1",
        role: "admin",
        full_name: "Ada Admin",
        email: "ada@example.invalid",
      };
    });
  });

  it("erro de hidratação, logout e novo login staff não chamam loadCurationProfile", async () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <App />
      </MemoryRouter>,
    );

    emitAuth("SIGNED_IN", session);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível confirmar a sessão. Entre novamente.",
    );
    expect(screen.getByRole("heading", { name: "Entrar para curadoria ou admin" })).toBeInTheDocument();
    expect(loadCurationProfile).not.toHaveBeenCalled();
    expect(supabaseState.getUser).not.toHaveBeenCalled();

    emitAuth("SIGNED_OUT", null);
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Entrar para curadoria ou admin" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ada@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "staff-secret" } });
    fireEvent.click(screen.getByRole("button", { name: /^Entrar$/ }));

    expect(await screen.findByRole("heading", { name: "Painel" })).toBeInTheDocument();
    expect(loadCurationProfile).not.toHaveBeenCalled();
    expect(supabaseState.getUser).not.toHaveBeenCalled();
  });
});
