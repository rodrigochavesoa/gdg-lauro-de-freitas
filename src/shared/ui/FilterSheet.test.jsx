import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilterSheet } from "./FilterSheet.jsx";

describe("FilterSheet", () => {
  it("rotula o CTA com a contagem filtrada", () => {
    const { rerender } = render(
      <FilterSheet open={false} onClose={() => {}} resultCount={0} titleId="filters-title">
        <h2 id="filters-title">Filtros</h2>
      </FilterSheet>,
    );
    expect(screen.getByRole("button", { name: "Ver 0 resultados" })).toBeInTheDocument();
    rerender(
      <FilterSheet open={false} onClose={() => {}} resultCount={1} titleId="filters-title">
        <h2 id="filters-title">Filtros</h2>
      </FilterSheet>,
    );
    expect(screen.getByRole("button", { name: "Ver 1 resultado" })).toBeInTheDocument();
    rerender(
      <FilterSheet open={false} onClose={() => {}} resultCount={4} titleId="filters-title">
        <h2 id="filters-title">Filtros</h2>
      </FilterSheet>,
    );
    expect(screen.getByRole("button", { name: "Ver 4 resultados" })).toBeInTheDocument();
  });

  it("abre como dialog e fecha no backdrop, no CTA e no Escape", () => {
    const onClose = vi.fn();
    const ui = (open) => (
      <FilterSheet open={open} onClose={onClose} resultCount={3} titleId="filters-title">
        <h2 id="filters-title">Filtros</h2>
        <p>React ativo</p>
      </FilterSheet>
    );

    const { rerender } = render(ui(true));
    expect(screen.getByRole("dialog", { name: "Filtros" })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Ver 3 resultados" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar filtros" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(ui(true));
    fireEvent.click(screen.getByRole("button", { name: "Ver 3 resultados" }));
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(ui(true));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);

    rerender(ui(false));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("React ativo")).toBeInTheDocument();
  });

  it("prende Tab no painel e marca o conteúdo atrás como inert", () => {
    const onClose = vi.fn();
    render(
      <main id="conteudo">
        <button type="button">Fora do diálogo</button>
        <FilterSheet open onClose={onClose} resultCount={2} titleId="filters-title">
          <h2 id="filters-title">Filtros</h2>
          <button type="button">React</button>
        </FilterSheet>
      </main>,
    );

    const outside = screen.getByRole("button", { name: "Fora do diálogo" });
    expect(outside.hasAttribute("inert") || outside.closest("[inert]")).toBeTruthy();

    const first = screen.getByRole("button", { name: "Fechar filtros" });
    const last = screen.getByRole("button", { name: "Ver 2 resultados" });
    expect(document.activeElement).toBe(first);

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("devolve o foco ao botão que abriu o sheet ao fechar", () => {
    const onClose = vi.fn();
    const opener = document.createElement("button");
    opener.textContent = "Filtros";
    document.body.append(opener);
    opener.focus();

    const { rerender } = render(
      <FilterSheet open onClose={onClose} resultCount={1} titleId="filters-title">
        <h2 id="filters-title">Filtros</h2>
      </FilterSheet>,
    );
    expect(document.activeElement).not.toBe(opener);

    rerender(
      <FilterSheet open={false} onClose={onClose} resultCount={1} titleId="filters-title">
        <h2 id="filters-title">Filtros</h2>
      </FilterSheet>,
    );
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
