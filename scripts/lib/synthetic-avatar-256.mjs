/**
 * Avatar sintético 256×256 JPEG, sem PII — usado só em medições locais PERF-AVATAR-01.
 * Gera via canvas no Playwright (mesmo tamanho de saída do crop de produção).
 */
export async function createSyntheticAvatar256(page) {
  const bytes = await page.evaluate(async () => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, "#4a90d9");
    gradient.addColorStop(1, "#2d6a9f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, size - 20, size - 20);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("256", size / 2, size / 2 + 6);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return new Uint8Array(await blob.arrayBuffer());
  });
  return Buffer.from(bytes);
}
