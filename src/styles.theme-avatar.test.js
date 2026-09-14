import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "styles.css"), "utf8");

function firstRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\{([^}]+)\\}`));
  return match?.[1] ?? "";
}

describe("UX-THEME-AVATAR-SHIFT-01 — box model do eyebrow", () => {
  it("reserva 1px de borda no hero em todos os temas e só troca a cor no dark", () => {
    expect(firstRule(".hero .eyebrow")).toMatch(/border:\s*1px solid transparent/);
    expect(css).toMatch(
      /html\[data-theme="dark"\] \.hero \.eyebrow\{[^}]*border-color:\s*rgb\(255 255 255 \/ 32%\)/,
    );
    expect(css).not.toMatch(
      /html\[data-theme="dark"\] \.hero \.eyebrow\{[^}]*border:\s*1px solid/,
    );
  });
});
