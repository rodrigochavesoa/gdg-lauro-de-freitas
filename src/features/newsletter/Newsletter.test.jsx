import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Newsletter } from "./Newsletter.jsx";
import { NEWSLETTER } from "./newsletter-content.js";

function renderNewsletter(props) {
  return render(
    <MemoryRouter>
      <Newsletter {...props} />
    </MemoryRouter>,
  );
}

describe("Newsletter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("espelha o shell da Home com as zonas estáticas e sem avatar DS-07", () => {
    renderNewsletter();

    expect(document.querySelector(".hero")).toBeTruthy();
    expect(document.querySelector(".home-divider__curve")).toBeTruthy();
    expect(document.querySelector(".home-divider__avatar")).toBeNull();
    expect(document.querySelector(".newsletter-layout")).toBeTruthy();
    expect(document.querySelector(".job-card--skeleton")).toBeNull();

    expect(screen.getByRole("heading", { level: 1, name: /GDG Jobs Letter/i })).toBeInTheDocument();
    expect(screen.getByText(NEWSLETTER.lead)).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: NEWSLETTER.subscribeTitle })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: NEWSLETTER.subscribeCta })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(NEWSLETTER.subscribeNote)).toBeInTheDocument();
    expect(document.querySelector(".newsletter-subscribe__fields")).toBeTruthy();
    expect(screen.getByLabelText(NEWSLETTER.nameLabel)).toBeDisabled();
    expect(screen.getByLabelText(NEWSLETTER.emailLabel)).toBeDisabled();

    expect(screen.getByRole("heading", { name: NEWSLETTER.issuesTitle })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: NEWSLETTER.issues[0].title })).toBeInTheDocument();
    const issueCtas = screen.getAllByRole("button", { name: NEWSLETTER.issueCta });
    expect(issueCtas).toHaveLength(NEWSLETTER.issues.length);
    issueCtas.forEach((button) => {
      expect(button).toHaveClass("newsletter-issue__cta");
      expect(button).toHaveAttribute("aria-disabled", "true");
    });

    const cta = screen.getByRole("link", { name: NEWSLETTER.ctaAction });
    expect(cta).toHaveAttribute("href", "/login");
    expect(cta).toHaveClass("white-button");
    expect(screen.getByRole("heading", { name: /O que importa para sua carreira/i })).toBeInTheDocument();
    expect(document.querySelector(".cta")).toBeTruthy();
    expect(screen.queryByText(/Carregando/i)).not.toBeInTheDocument();
  });

  it("omite a faixa CTA quando o visitante já está logado", () => {
    renderNewsletter({ logged: true });
    expect(screen.queryByRole("link", { name: NEWSLETTER.ctaAction })).not.toBeInTheDocument();
    expect(document.querySelector(".cta")).toBeNull();
    expect(document.querySelector(".hero")).toBeTruthy();
    expect(document.querySelector(".home-divider__curve")).toBeTruthy();
  });

  it("não dispara fetch no mount", () => {
    const spy = vi.spyOn(globalThis, "fetch");
    renderNewsletter();
    expect(spy).not.toHaveBeenCalled();
  });
});
