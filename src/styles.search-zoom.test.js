import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "styles.css"), "utf8");
const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "index.html"), "utf8");

function firstRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\{([^}]+)\\}`));
  return match?.[1] ?? "";
}

describe("UX-MOBILE-SEARCH-ZOOM-01 — iOS auto-zoom", () => {
  it("usa body-1 (>=16px) nos inputs de busca e não restringe o viewport", () => {
    expect(firstRule(".searchbox input")).toMatch(/font-size:\s*var\(--font-size-body-1\)/);
    expect(firstRule(".prototype-search input")).toMatch(/font-size:\s*var\(--font-size-body-1\)/);
    expect(css).not.toMatch(/\.searchbox input\{[^}]*font-size:\s*\.9375rem/);
    expect(css).not.toMatch(/\.prototype-search input\{[^}]*font-size:\s*\.9375rem/);
    expect(html).not.toMatch(/maximum-scale\s*=\s*1|user-scalable\s*=\s*no/i);
  });
});
