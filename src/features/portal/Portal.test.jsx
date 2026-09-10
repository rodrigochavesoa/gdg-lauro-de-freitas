import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Portal } from "./Portal.jsx";

describe("Portal", () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mantém o avatar estático e só revela o gatilho ao passar o mouse", () => {
    render(
      <MemoryRouter>
        <Portal />
      </MemoryRouter>,
    );

    const stage = document.querySelector(".avatar-stage--portal");

    expect(screen.getByRole("img", { name: "Avatar do GDG Jobs com notebook" })).toBeInTheDocument();
    expect(stage.querySelector("video")).toBeNull();

    fireEvent.pointerEnter(stage, { pointerType: "mouse" });

    expect(screen.getByRole("button", { name: "Abrir o portal animado do GDG Jobs" })).toBeInTheDocument();
    expect(stage.querySelector("video")).toBeNull();
  });

  it("abre o portal somente ao clicar em Abra o portal", () => {
    render(
      <MemoryRouter>
        <Portal />
      </MemoryRouter>,
    );

    const stage = document.querySelector(".avatar-stage--portal");
    const trigger = screen.getByRole("button", { name: "Abrir o portal animado do GDG Jobs" });

    fireEvent.pointerEnter(stage, { pointerType: "mouse" });
    expect(stage.querySelector("video")).toBeNull();

    fireEvent.click(trigger);

    expect(stage.querySelector("video")).toHaveAttribute("src", "/gdg-video-avatar.mp4");
    expect(stage).toHaveClass("is-portal-open");
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
  });

  it("fecha o portal ao sair da área do avatar", () => {
    render(
      <MemoryRouter>
        <Portal />
      </MemoryRouter>,
    );

    const stage = document.querySelector(".avatar-stage--portal");
    const trigger = screen.getByRole("button", { name: "Abrir o portal animado do GDG Jobs" });

    fireEvent.pointerEnter(stage, { pointerType: "mouse" });
    fireEvent.click(trigger);
    expect(stage).toHaveClass("is-portal-open");

    fireEvent.pointerLeave(stage, { pointerType: "mouse" });

    expect(stage).not.toHaveClass("is-portal-open");
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it("mostra ações úteis para quem já está logado e tem perfil completo", () => {
    render(
      <MemoryRouter>
        <Portal
          logged
          email="ana@example.com"
          profile={{
            full_name: "Ana Demo",
            role: "candidate",
            skills: ["React"],
            preferences: { experience_level: "mid", work_model: "remote", location: "Brasil" },
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Seu perfil já está pronto para novas oportunidades." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explorar vagas" })).toHaveAttribute("href", "/vagas");
    expect(screen.getByRole("link", { name: "Minhas candidaturas" })).toHaveAttribute("href", "/minhas-candidaturas");
    expect(screen.queryByRole("link", { name: "Criar perfil gratuito" })).not.toBeInTheDocument();
  });

  it("convida o usuário logado a completar o perfil quando necessário", () => {
    render(
      <MemoryRouter>
        <Portal logged email="ana@example.com" profile={{ role: "candidate" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Deixe seu perfil trabalhar por você." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Completar meu perfil" })).toHaveAttribute("href", "/onboarding");
    expect(screen.queryByRole("link", { name: "Criar perfil gratuito" })).not.toBeInTheDocument();
  });

  it("direciona perfis de equipe para o painel da comunidade", () => {
    render(
      <MemoryRouter>
        <Portal logged profile={{ full_name: "Ada Admin", role: "admin" }} email="ada@example.com" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Continue fazendo a tecnologia acontecer." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir painel" })).toHaveAttribute("href", "/admin");
  });
});
