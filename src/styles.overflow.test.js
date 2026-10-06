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

describe("UX-ONBOARD-NOTICE-01 — inset do header", () => {
  it("não estica .topbar>.nav a 100% (preserva o respiro do .shell)", () => {
    expect(css).not.toMatch(/\.topbar>\.nav\{[^}]*width:\s*100%/);
  });

  it("usa texto inverso no aviso de onboarding no dark", () => {
    expect(css).toMatch(
      /html\[data-theme="dark"\] \.nav-gate-notice,\s*html\[data-theme="dark"\] \.nav-gate-notice__link\{color:var\(--color-text-inverse\)\}/,
    );
  });
});

describe("FIX-ADMIN-COMMUNITY-HERO-01 — alinhamento da comunidade no workspace admin", () => {
  it("usa a largura real do menu, sem margem duplicada, no desktop", () => {
    const shell = firstRule(".admin-workspace .admin-shell:has(.community-page--embedded)");
    expect(shell).toMatch(/width:\s*100%/);
    expect(shell).toMatch(/margin:\s*0/);

    const embeddedContent = firstRule(".admin-workspace .admin-content:has(.community-page--embedded)");
    expect(embeddedContent).toMatch(/width:\s*calc\(100% - 236px\)/);
    expect(embeddedContent).toMatch(/margin:\s*0 0 0 236px/);
    expect(embeddedContent).toMatch(/padding:\s*0/);

    const collapsedContent = firstRule(
      ".admin-workspace:has(.admin-sidebar--collapsed) .admin-content:has(.community-page--embedded)",
    );
    expect(collapsedContent).toMatch(/width:\s*calc\(100% - 66px\)/);
    expect(collapsedContent).toMatch(/margin-left:\s*66px/);
  });

  it("preenche o fundo vertical da área e libera a largura no mobile", () => {
    expect(css).toMatch(
      /\.community-page--embedded\{min-height:calc\(100vh - 75px\);padding:0;background:var\(--color-surface\)\}/,
    );
    expect(css).toMatch(
      /\.admin-workspace \.admin-content:has\(\.community-page--embedded\),\s*\.admin-workspace:has\(\.admin-sidebar--collapsed\) \.admin-content:has\(\.community-page--embedded\)\{width:100%;margin:0;padding-top:0\}/,
    );
    expect(css).toMatch(
      /\.community-page--embedded\{min-height:calc\(100vh - 62px\)\}/,
    );
  });
});
