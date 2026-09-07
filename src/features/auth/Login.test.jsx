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
    fireEvent.click(screen.getByRole("button", { name: /Entrar ou criar conta com Google/i }));
    expect(startGoogleOAuth).toHaveBeenCalledTimes(1);
  });

  it("mostra caminhos de candidato e empresa sem formulário de e-mail", () => {
    renderLogin();
    expect(screen.queryByLabelText(/e-mail/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Você é novo no GDG Jobs?" })).toBeInTheDocument();
    expect(screen.getByText("Candidato")).toBeInTheDocument();
    expect(screen.getByText("Empresa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entrar ou criar conta com Google/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Publicar vagas — área administrativa" })).toHaveAttribute(
      "href",
      "/admin",
    );
  });
});
