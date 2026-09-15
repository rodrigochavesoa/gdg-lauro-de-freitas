import { describe, expect, it } from "vitest";
import jsxA11y from "eslint-plugin-jsx-a11y";
import { jsxA11yRecommendedWarnRules } from "../eslint.config.js";
import { asWarnRules, isErrorLevel } from "../eslint.jsx-a11y-warn.js";

describe("jsx-a11y recommended em warn", () => {
  it("expõe as regras recommended do plugin", () => {
    const recommended = jsxA11y.flatConfigs.recommended.rules;
    expect(Object.keys(jsxA11yRecommendedWarnRules).sort()).toEqual(Object.keys(recommended).sort());
  });

  it("não deixa nenhuma regra jsx-a11y em error", () => {
    const errorRules = Object.entries(jsxA11yRecommendedWarnRules)
      .filter(([name, value]) => name.startsWith("jsx-a11y/") && isErrorLevel(value))
      .map(([name]) => name);
    expect(errorRules).toEqual([]);
  });

  it("converte error e opções para warn sem perder config", () => {
    expect(asWarnRules({ "jsx-a11y/alt-text": "error" })).toEqual({ "jsx-a11y/alt-text": "warn" });
    expect(asWarnRules({ "jsx-a11y/interactive-supports-focus": ["error", { tabbable: ["button"] }] })).toEqual({
      "jsx-a11y/interactive-supports-focus": ["warn", { tabbable: ["button"] }],
    });
    expect(asWarnRules({ "jsx-a11y/anchor-ambiguous-text": "off" })).toEqual({
      "jsx-a11y/anchor-ambiguous-text": "off",
    });
  });
});
