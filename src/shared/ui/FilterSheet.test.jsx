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
});
