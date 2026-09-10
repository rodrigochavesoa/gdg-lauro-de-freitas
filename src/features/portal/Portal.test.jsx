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
});
