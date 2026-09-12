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

describe("UX-MOBILE-OVERFLOW-01 — junta DS-07", () => {
  it("clipa o transbordo horizontal da curva sem esconder o avatar", () => {
    const divider = firstRule(".home-divider");
    expect(divider).toMatch(/overflow-x:\s*clip/);
    expect(divider).toMatch(/overflow-y:\s*visible/);
    expect(divider).not.toMatch(/(?:^|;)overflow:\s*visible/);

    const curve = firstRule(".home-divider__curve");
    expect(curve).toMatch(/width:\s*calc\(100% \+ 16px\)/);
    expect(curve).toMatch(/margin-left:\s*-8px/);
  });

  it("não mascara o overflow só no body", () => {
    expect(css).not.toMatch(/\bbody\{[^}]*overflow-x:\s*hidden/);
  });
});
