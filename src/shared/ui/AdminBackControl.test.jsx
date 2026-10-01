import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AdminBackButton, AdminBackLink } from "./AdminBackControl.jsx";

describe("AdminBackControl", () => {
  it("renderiza botão com classe padrão de voltar", () => {
    render(<AdminBackButton onClick={() => {}}>Voltar à fila</AdminBackButton>);
    const control = screen.getByRole("button", { name: "Voltar à fila" });
    expect(control).toHaveClass("admin-back-button");
    expect(control.querySelector("svg")).toBeTruthy();
  });

  it("renderiza link com a mesma classe", () => {
    render(
      <MemoryRouter>
        <AdminBackLink to="/admin/vagas">Voltar às vagas</AdminBackLink>
      </MemoryRouter>,
    );
    const control = screen.getByRole("link", { name: "Voltar às vagas" });
    expect(control).toHaveClass("admin-back-button");
  });
});
