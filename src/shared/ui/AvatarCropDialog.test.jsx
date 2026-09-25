import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AvatarCropDialog } from "./AvatarCropDialog.jsx";

const image = { src: "blob:crop" };

describe("AvatarCropDialog", () => {
  it("prende Tab no diálogo, fecha no Escape e marca o fundo como inert", () => {
    const onCancel = vi.fn();
    render(
      <main id="conteudo">
        <button type="button">Fora do recorte</button>
        <AvatarCropDialog image={image} onCancel={onCancel} onConfirm={() => {}} busy={false} error="" />
      </main>,
    );

    const outside = screen.getByRole("button", { name: "Fora do recorte" });
    expect(outside.hasAttribute("inert") || outside.closest("[inert]")).toBeTruthy();

    const confirm = screen.getByRole("button", { name: "Usar foto" });
    const cancel = screen.getByRole("button", { name: "Cancelar" });
    expect(document.activeElement).toBe(confirm);

    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(cancel);
    expect(screen.getByRole("dialog", { name: "Recortar foto" }).contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirm);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
