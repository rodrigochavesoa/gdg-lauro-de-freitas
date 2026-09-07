import React from "react";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const startGoogleOAuth = vi.fn(async () => {});

vi.mock("./auth-api.js", () => ({
  startGoogleOAuth: (...args) => startGoogleOAuth(...args),
}));

import { Login } from "./Login.jsx";

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
}

describe("Login", () => {
  it("inicia OAuth Google pelo adaptador, sem client no JSX", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: /Continuar com Google/i }));
    expect(startGoogleOAuth).toHaveBeenCalledTimes(1);
  });

  it("mostra alerta impossível de ignorar ao continuar com e-mail", () => {
    renderLogin();
    expect(screen.getByRole("alert")).toHaveTextContent(/só com Google/i);
    fireEvent.click(screen.getByRole("button", { name: /^Continuar$/i }));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/entre com Google/i);
    expect(alert).toHaveTextContent(/admin e curadoria/i);
    expect(document.activeElement).toBe(alert);
    expect(screen.getByRole("link", { name: "Staff? Área admin" })).toHaveAttribute("href", "/admin");
  });
});
