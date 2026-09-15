import { describe, expect, it } from "vitest";
import {
  AXE_TAGS,
  REPORT_DIR_REL,
  assertNoSecrets,
  buildMarkdownReport,
  exitCodeForRun,
  sanitizeAxeResults,
  summarizeScans,
  supabaseAuthStorageKey,
} from "./qa-a11y.mjs";

describe("qa-a11y report-only", () => {
  it("não falha o processo por violações axe", () => {
    expect(exitCodeForRun({ requiredErrors: [] })).toBe(0);
    expect(
      exitCodeForRun({
        requiredErrors: [],
      }),
    ).toBe(0);
  });

  it("falha só quando rota obrigatória não carrega", () => {
    expect(exitCodeForRun({ requiredErrors: ["home-light-1280: net::ERR_CONNECTION_REFUSED"] })).toBe(1);
  });

  it("grava evidência só em docs-local e usa tags WCAG 2.2 AA", () => {
    expect(REPORT_DIR_REL).toBe("docs-local/assets/a11y-gov-01");
    expect(AXE_TAGS).toContain("wcag22aa");
    expect(AXE_TAGS).toContain("wcag2aa");
  });

  it("remove HTML dos nós axe e não deixa senha no relatório", () => {
    const sanitized = sanitizeAxeResults({
      url: "http://127.0.0.1:5173/login",
      violations: [
        {
          id: "color-contrast",
          impact: "serious",
          description: "contrast",
          help: "Elements must have sufficient color contrast",
          helpUrl: "https://example.invalid/contrast",
          tags: ["wcag2aa"],
          nodes: [{ html: "<input type=\"password\" value=\"super-secret\">", target: ["input"], failureSummary: "Fix" }],
        },
      ],
      incomplete: [],
      passes: [{ id: "image-alt" }],
      inapplicable: [{ id: "frame-title" }, { id: "video-caption" }],
    });
    const text = JSON.stringify(sanitized);
    expect(text).not.toContain("super-secret");
    expect(text).not.toContain("<input");
    expect(sanitized.violations[0].nodes[0].target).toEqual(["input"]);
    expect(sanitized.passesCount).toBe(1);
    expect(assertNoSecrets(text, ["super-secret"])).toEqual([]);
  });

  it("agrega regras e o markdown declara que não é certificação", () => {
    const summary = summarizeScans([
      {
        id: "login-light-1280",
        route: "/login",
        theme: "light",
        viewport: { width: 1280, height: 720 },
        axe: {
          violations: [{ id: "button-name", impact: "critical", help: "Buttons must have discernible text", nodes: [{ target: ["button"] }] }],
        },
      },
    ]);
    const md = buildMarkdownReport({
      generatedAt: "2026-09-15T00:00:00.000Z",
      baseUrl: "http://127.0.0.1:5173",
      axeTags: AXE_TAGS,
      limitations: ["Axe não cobre teclado completo."],
      notTested: ["VLibras"],
      skipped: ["/admin: sem credenciais"],
      scans: [
        {
          id: "login-light-1280",
          route: "/login",
          theme: "light",
          viewport: { width: 1280, height: 720 },
          axe: { violations: [{ id: "button-name", impact: "critical", help: "Buttons must have discernible text" }] },
        },
      ],
      summary,
    });
    expect(summary.uniqueRules).toEqual([
      expect.objectContaining({ ruleId: "button-name", scans: 1, nodes: 1 }),
    ]);
    expect(md).toMatch(/não é certificação WCAG/i);
    expect(md).not.toMatch(/está certificado/i);
    expect(md).toContain("/admin: sem credenciais");
  });

  it("deriva a chave de sessão Supabase sem interpolar senha", () => {
    expect(supabaseAuthStorageKey("https://abcdefgh.supabase.co")).toBe("sb-abcdefgh-auth-token");
    expect(supabaseAuthStorageKey("not-a-url")).toBeNull();
  });
});
