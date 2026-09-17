import { describe, expect, it } from "vitest";
import { generateTotp } from "./totp.mjs";

describe("generateTotp", () => {
  // RFC 6238 apêndice B — secret ASCII "12345678901234567890" em base32.
  const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

  it("bate o vetor SHA-1 de 6 dígitos em t=59s", () => {
    expect(generateTotp(rfcSecret, { now: 59_000 })).toBe("287082");
  });

  it("é estável dentro do mesmo período de 30s", () => {
    const a = generateTotp(rfcSecret, { now: 1_111_111_111_000 });
    const b = generateTotp(rfcSecret, { now: 1_111_111_111_000 + 10_000 });
    expect(a).toBe(b);
    expect(a).toMatch(/^\d{6}$/);
  });

  it("rejeita secret vazio ou inválido", () => {
    expect(() => generateTotp("")).toThrow(/vazio/);
    expect(() => generateTotp("????")).toThrow(/inválido/);
  });
});
