import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AVATAR_MAX_BYTES, assertAvatarFile, loadImageFromFile, revokeLoadedImageUrl } from "./avatar-crop.js";

const BLOB_URL = "blob:https://preview.test/avatar";
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

function stubObjectUrls() {
  URL.createObjectURL = vi.fn(() => BLOB_URL);
  URL.revokeObjectURL = vi.fn();
}

function restoreObjectUrls() {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
}

describe("loadImageFromFile", () => {
  let OriginalImage;

  beforeEach(() => {
    OriginalImage = globalThis.Image;
    stubObjectUrls();
    class FakeImage {
      constructor() {
        this.onload = null;
        this.onerror = null;
        this._src = "";
      }
      set src(value) {
        this._src = value;
        queueMicrotask(() => this.onload?.());
      }
      get src() {
        return this._src;
      }
    }
    globalThis.Image = FakeImage;
  });

  afterEach(() => {
    globalThis.Image = OriginalImage;
    restoreObjectUrls();
  });

  it("não revoga o object URL no load — o preview do crop reusa image.src", async () => {
    const image = await loadImageFromFile(new File(["x"], "foto.jpg", { type: "image/jpeg" }));
    expect(image.src).toBe(BLOB_URL);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("revoga o object URL se a imagem falhar ao decodificar", async () => {
    class FailImage {
      set src(value) {
        this._src = value;
        queueMicrotask(() => this.onerror?.());
      }
      get src() {
        return this._src;
      }
    }
    globalThis.Image = FailImage;
    await expect(loadImageFromFile(new File(["x"], "foto.jpg", { type: "image/jpeg" }))).rejects.toThrow(
      /Não foi possível ler a imagem/,
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(BLOB_URL);
  });
});

describe("revokeLoadedImageUrl", () => {
  beforeEach(stubObjectUrls);
  afterEach(restoreObjectUrls);

  it("revoga só blob: após o crop fechar", () => {
    revokeLoadedImageUrl({ src: BLOB_URL });
    revokeLoadedImageUrl({ src: "https://signed.example/u1" });
    revokeLoadedImageUrl(null);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(BLOB_URL);
  });
});

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
