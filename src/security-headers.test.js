import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = JSON.parse(readFileSync("vercel.json", "utf8"));
const html = readFileSync("index.html", "utf8");

const REQUIRED = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

function headerMap(block) {
  return Object.fromEntries(block.headers.map((header) => [header.key, header.value]));
}

function assertProtectionHeaders(headers) {
  for (const [key, value] of Object.entries(REQUIRED)) {
    expect(headers[key]).toBe(value);
  }
  expect(headers["Permissions-Policy"]).toMatch(/camera=\(\)/);
  expect(headers["Permissions-Policy"]).toMatch(/geolocation=\(\)/);
  expect(headers["Permissions-Policy"]).toMatch(/microphone=\(\)/);
  expect(headers["Permissions-Policy"]).toMatch(/payment=\(\)/);
  expect(headers["Permissions-Policy"]).toMatch(/autoplay=\(self\)/);

  const csp = headers["Content-Security-Policy"];
  expect(csp).toMatch(/default-src 'self'/);
  expect(csp).toMatch(/frame-ancestors 'none'/);
  expect(csp).toMatch(/object-src 'none'/);
  expect(csp).toMatch(/https:\/\/\*\.supabase\.co/);
  expect(csp).toMatch(/wss:\/\/\*\.supabase\.co/);
  expect(csp).toMatch(/accounts\.google\.com/);
  expect(csp).toMatch(/fonts\.googleapis\.com/);
  expect(csp).toMatch(/fonts\.gstatic\.com/);
  expect(csp).not.toMatch(/unsafe-eval/);
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
}

describe("SEC-HEADERS-01", () => {
  it("mantém o fallback SPA", () => {
    expect(config.rewrites).toEqual([{ source: "/(.*)", destination: "/index.html" }]);
  });

  it("aplica os mesmos headers em / e /:path* para a home estática e o restante da SPA", () => {
    expect(config.headers.map((entry) => entry.source)).toEqual(["/", "/:path*"]);
    expect(config.headers[0].headers).toEqual(config.headers[1].headers);
    assertProtectionHeaders(headerMap(config.headers[0]));
  });

  it("carrega o tema por arquivo próprio para o CSP omitir unsafe-inline em scripts", () => {
    expect(html).toMatch(/src="\/theme-init\.js"/);
    expect(html).not.toMatch(/<script>\s*\(function/);
  });
});
