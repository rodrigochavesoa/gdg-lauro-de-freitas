import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Onboarding } from "./Onboarding.jsx";

const saveOnboardingProfile = vi.hoisted(() => vi.fn());

vi.mock("./auth-api.js", () => ({
  saveOnboardingProfile: (...args) => saveOnboardingProfile(...args),
}));

describe("Onboarding", () => {
  beforeEach(() => {
    saveOnboardingProfile.mockReset();
  });

  it("anuncia erro de persistência com alerta, não com token de sucesso", async () => {
    saveOnboardingProfile.mockRejectedValue(new Error("Não foi possível salvar o perfil"));
    render(<Onboarding profile={{}} email="ada@example.invalid" onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Nível"), { target: { value: "junior" } });
    fireEvent.change(screen.getByLabelText("Modalidade"), { target: { value: "remote" } });
    fireEvent.change(screen.getByLabelText("Tecnologias (separe por vírgula)"), { target: { value: "React" } });
    fireEvent.change(screen.getByLabelText("Localidade"), { target: { value: "Salvador" } });
    fireEvent.submit(screen.getByRole("button", { name: "Salvar perfil" }).closest("form"));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveClass("form-alert");
    expect(alert).not.toHaveClass("success");
    expect(alert).toHaveTextContent("Não foi possível salvar o perfil");
  });

  it("reutiliza admin-shell, admin-content e admin-title com o eyebrow Perfil mínimo", () => {
    const { container } = render(<Onboarding profile={{}} email="ada@example.invalid" onSaved={vi.fn()} />);
    const main = container.querySelector("main.admin-page");
    expect(main.querySelector(".shell.admin-shell")).toBeTruthy();
    expect(main.querySelector(".admin-content")).toBeTruthy();
    expect(main.querySelector(".admin-title .eyebrow")).toHaveTextContent("Perfil mínimo");
  });
});
