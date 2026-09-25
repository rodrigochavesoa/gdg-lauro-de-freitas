import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AvatarCropDialog } from "./AvatarCropDialog.jsx";

const image = { src: "blob:crop" };

function CropFromButton() {
  const [open, setOpen] = useState(false);
  return (
    <main id="conteudo">
      <button type="button" onClick={() => setOpen(true)}>Alterar foto</button>
      {open ? (
        <AvatarCropDialog
          image={image}
          onCancel={() => setOpen(false)}
          onConfirm={() => {}}
          busy={false}
          error=""
        />
      ) : null}
    </main>
  );
}

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

  it("ao cancelar devolve o foco ao botão que abriu e remove o inert", () => {
    render(<CropFromButton />);
    const opener = screen.getByRole("button", { name: "Alterar foto" });
    opener.focus();
    fireEvent.click(opener);

    expect(screen.getByRole("dialog", { name: "Recortar foto" })).toBeInTheDocument();
    expect(opener.hasAttribute("inert") || opener.closest("[inert]")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog", { name: "Recortar foto" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
    expect(opener.hasAttribute("inert")).toBe(false);
    expect(opener.closest("[inert]")).toBeNull();
    expect(document.querySelector("[inert]")).toBeNull();
  });
});
