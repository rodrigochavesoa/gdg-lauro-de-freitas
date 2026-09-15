import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "styles.css"), "utf8");

describe("MVP-019 — a11y e contraste via tokens", () => {
  it("expõe skip link, foco em âncoras e sr-only", () => {
    expect(css).toMatch(/\.skip-link\{/);
    expect(css).toMatch(/a:focus-visible/);
    expect(css).toMatch(/\.job-card:focus-visible/);
    expect(css).toMatch(/\.sr-only\{/);
    expect(css).toMatch(/#conteudo\{scroll-margin-top:80px\}/);
    expect(css).toMatch(/\.skip-link\{[^}]*padding:var\(--space-3\) var\(--space-4\)/);
    expect(css).not.toMatch(/\.skip-link\{[^}]*padding:10px 14px/);
  });

  it("desliga animações longas com prefers-reduced-motion", () => {
    expect(css).toMatch(/prefers-reduced-motion:reduce[\s\S]*\.job-card\{transition:none\}/);
    expect(css).toMatch(/\.job-card:hover\{transform:none\}/);
    expect(css).toMatch(/\.portal-chip\{animation:none\}/);
  });

  it("usa tokens no dark para muted, danger e CTA do portal", () => {
    expect(css).toMatch(/html\[data-theme="dark"\][\s\S]*--color-text-muted:\s*#d4d4d8/);
    expect(css).toMatch(/html\[data-theme="dark"\][\s\S]*--color-danger-700:\s*#fb7185/);
    expect(css).toMatch(/html\[data-theme="dark"\][\s\S]*--color-brand-accent:\s*#93c5fd/);
    expect(css).toMatch(/\.form-alert\{[^}]*border:1px solid var\(--color-danger-700\)/);
    expect(css).toMatch(/\.portal-member-cta__copy p\{color:var\(--color-on-brand-muted\)\}/);
    expect(css).toMatch(/\.portal-member-cta__secondary\{[^}]*color:var\(--color-on-brand\)/);
    expect(css).not.toMatch(/\.portal-member-cta__copy p\{color:#dbeafe\}/);
    expect(css).toMatch(/\.portal-video-hint:focus-visible\{outline:3px solid var\(--color-focus\)/);
  });
});
