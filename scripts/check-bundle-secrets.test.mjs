import { describe, expect, it } from "vitest";
import { FORBIDDEN_PATTERNS, findForbiddenSecrets } from "./check-bundle-secrets.mjs";

describe("check-bundle-secrets", () => {
  it("não acusa chave publishable (browser)", () => {
    expect(findForbiddenSecrets("sb_publishable_demo_anon_ok")).toEqual([]);
    expect(findForbiddenSecrets("https://xxxx.supabase.co")).toEqual([]);
  });

  it("detecta service_role, sb_secret e chave privada", () => {
    expect(findForbiddenSecrets('role: "service_role"')).toContain("service_role");
    expect(findForbiddenSecrets("sb_secret_abc123XYZ")).toContain("sb_secret");
    expect(findForbiddenSecrets("-----BEGIN PRIVATE KEY-----")).toContain("private_key");
    expect(findForbiddenSecrets("SUPABASE_SERVICE_ROLE_KEY=x")).toContain("service_role_env");
    expect(findForbiddenSecrets("CLICKUP_API_TOKEN=pk_x")).toContain("clickup_token");
  });

  it("mantém a lista de padrões nomeada", () => {
    expect(FORBIDDEN_PATTERNS.map((item) => item.id)).toContain("service_role");
  });
});
