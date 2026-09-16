import { describe, expect, it } from "vitest";
import { AVATAR_MAX_BYTES, assertAvatarFile } from "./avatar-crop.js";

describe("assertAvatarFile", () => {
  it("rejeita arquivo ausente, tipo inválido e tamanho acima de 2 MB", () => {
    expect(() => assertAvatarFile(null)).toThrow(/Escolha uma imagem/);
    expect(() => assertAvatarFile({ type: "image/gif", size: 10 })).toThrow(/JPEG, PNG ou WebP/);
    expect(() => assertAvatarFile({ type: "image/jpeg", size: AVATAR_MAX_BYTES + 1 })).toThrow(/2 MB/);
  });

  it("aceita JPEG, PNG e WebP até 2 MB", () => {
    expect(assertAvatarFile({ type: "image/jpeg", size: 12 })).toEqual({ type: "image/jpeg", size: 12 });
    expect(assertAvatarFile({ type: "image/png", size: AVATAR_MAX_BYTES }).type).toBe("image/png");
    expect(assertAvatarFile({ type: "image/webp", size: 1 }).type).toBe("image/webp");
  });
});
