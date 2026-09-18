import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("coloca id e name nos campos nativos do onboarding", () => {
    render(<Onboarding profile={{}} email="ada@example.invalid" onSaved={vi.fn()} />);
    expect(screen.getByLabelText("Nome")).toHaveAttribute("id", "onboarding-full-name");
    expect(screen.getByLabelText("Nome")).toHaveAttribute("name", "fullName");
    expect(screen.getByLabelText("Nome")).not.toHaveAttribute("autocomplete");
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("name", "email");
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("aria-readonly", "true");
    expect(screen.getByLabelText("E-mail")).not.toHaveAttribute("autocomplete");
    expect(screen.getByLabelText("Nível")).toHaveAttribute("id", "onboarding-experience-level");
    expect(screen.getByLabelText("Localidade")).not.toHaveAttribute("autocomplete");
    expect(screen.getByLabelText("LinkedIn")).not.toHaveAttribute("autocomplete");
    const unnamed = [...document.querySelectorAll("input, select, textarea")].filter((el) => !el.id && !el.name);
    expect(unnamed).toEqual([]);
  });
});

describe("Onboarding modo edição", () => {
  const profile = {
    full_name: "Vinicius Costa",
    role: "candidate",
    skills: ["React", "Node"],
    bio: "Dev na comunidade",
    preferences: {
      experience_level: "mid",
      work_model: "remote",
      location: "Salvador",
      linkedin: "https://linkedin.com/in/vc",
      github: "https://github.com/vc",
      cv_url: "https://cv.example/vc.pdf",
    },
  };

  beforeEach(() => {
    saveOnboardingProfile.mockReset();
  });

  it("carrega valores salvos, e-mail somente leitura e não expõe papel", () => {
    render(<Onboarding mode="edit" profile={profile} email="vc@example.invalid" onSaved={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Editar perfil" })).toBeInTheDocument();
    expect(screen.getByText("Perfil")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("Vinicius Costa");
    expect(screen.getByLabelText("Nome")).toHaveAttribute("id", "profile-full-name");
    const email = screen.getByLabelText("E-mail");
    expect(email).toHaveValue("vc@example.invalid");
    expect(email).toHaveAttribute("readonly");
    expect(email).toHaveAttribute("aria-readonly", "true");
    expect(screen.getByLabelText("Nível")).toHaveValue("mid");
    expect(screen.getByLabelText("Modalidade")).toHaveValue("remote");
    expect(screen.getByLabelText("Tecnologias (separe por vírgula)")).toHaveValue("React, Node");
    expect(screen.getByLabelText("Localidade")).toHaveValue("Salvador");
    expect(screen.getByLabelText("Bio")).toHaveValue("Dev na comunidade");
    expect(screen.getByLabelText("LinkedIn")).toHaveValue("https://linkedin.com/in/vc");
    expect(screen.queryByLabelText(/papel|função|cargo/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /papel|função|role/i })).not.toBeInTheDocument();
  });

  it("persiste alterações nos campos do onboarding", async () => {
    const saved = { ...profile, full_name: "Vinicius C.", skills: ["Go"] };
    saveOnboardingProfile.mockResolvedValue(saved);
    const onSaved = vi.fn();
    render(<Onboarding mode="edit" profile={profile} email="vc@example.invalid" onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Vinicius C." } });
    fireEvent.change(screen.getByLabelText("Tecnologias (separe por vírgula)"), { target: { value: "Go" } });
    fireEvent.submit(screen.getByRole("button", { name: "Salvar perfil" }).closest("form"));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(saveOnboardingProfile).toHaveBeenCalledWith(expect.objectContaining({
      fullName: "Vinicius C.",
      skillsText: "Go",
      experienceLevel: "mid",
      workModel: "remote",
      location: "Salvador",
    }));
    expect(onSaved).toHaveBeenCalledWith(saved);
  });
});
