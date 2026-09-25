import React, { useRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDialogFocusTrap } from "./useDialogFocusTrap.js";

function TrapDialog({ extra = false, disableFirst = false, empty = false }) {
  const containerRef = useRef(null);
  useDialogFocusTrap({ active: true, containerRef });
  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Trap"
      tabIndex={-1}
    >
      {empty ? null : (
        <>
          <button type="button" disabled={disableFirst}>Primeiro</button>
          <button type="button">Último</button>
          {extra ? <button type="button">Novo</button> : null}
        </>
      )}
    </div>
  );
}

describe("useDialogFocusTrap", () => {
  it("pula o primeiro botão desabilitado", () => {
    render(<TrapDialog disableFirst />);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Último" }));
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Último" }));
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });

  it("inclui um focável adicionado com o diálogo aberto", () => {
    const { rerender } = render(<TrapDialog />);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Primeiro" }));
    rerender(<TrapDialog extra />);
    screen.getByRole("button", { name: "Novo" }).focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Primeiro" }));
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });

  it("sem focáveis, Tab não sai do dialog", () => {
    render(<TrapDialog empty />);
    const dialog = screen.getByRole("dialog", { name: "Trap" });
    expect(document.activeElement).toBe(dialog);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(dialog);
  });
});
