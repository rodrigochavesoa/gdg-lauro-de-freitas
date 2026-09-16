export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_OUTPUT_SIZE = 256;
export const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function assertAvatarFile(file) {
  if (!file) throw new Error("Escolha uma imagem.");
  if (!AVATAR_TYPES.has(file.type)) throw new Error("Use JPEG, PNG ou WebP.");
  if (file.size > AVATAR_MAX_BYTES) throw new Error("A imagem deve ter no máximo 2 MB.");
  return file;
}

export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem."));
    };
    image.src = url;
  });
}

/** O preview do crop reusa `image.src`; só revogar ao fechar o diálogo ou desmontar. */
export function revokeLoadedImageUrl(image) {
  const src = image?.src;
  if (typeof src !== "string" || !src.startsWith("blob:")) return;
  URL.revokeObjectURL?.(src);
}

/** Recorte circular mínimo: cobre o canvas (object-fit cover) e clipa em círculo. */
export function cropImageToCircle(image, { size = AVATAR_OUTPUT_SIZE, scale = 1 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const minSide = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const source = Math.max(1, minSide / Math.max(1, scale));
  const sx = ((image.naturalWidth || image.width) - source) / 2;
  const sy = ((image.naturalHeight || image.height) - source) / 2;
  ctx.drawImage(image, sx, sy, source, source, 0, 0, size, size);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Não foi possível recortar a imagem."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.9,
    );
  });
}
