import { Buffer } from "node:buffer";
import { describe, expect, it, vi } from "vitest";
import {
  KEEPALIVE_REST_PATH,
  KEEPALIVE_TARGETS,
  formatKeepaliveLog,
  isLegacyAnonJwt,
  pingTarget,
  privilegedKeyError,
  restHeaders,
  runKeepalive,
  targetUrlError,
} from "./keepalive-supabase.mjs";
import { OFFICIAL_HOMOLOG_PROJECT_REF, OFFICIAL_PROD_PROJECT_REF } from "./prod-migrations.mjs";

function jwtWithRole(role) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ role, iss: "supabase" })).toString("base64url");
  return `${header}.${payload}.sig`;
}

const HOMOLOG_URL = `https://${OFFICIAL_HOMOLOG_PROJECT_REF}.supabase.co`;
const PROD_URL = `https://${OFFICIAL_PROD_PROJECT_REF}.supabase.co`;
const PUBLISHABLE = "sb_publishable_demo_keepalive_ok";
const ANON = jwtWithRole("anon");

describe("keepalive supabase", () => {
  it("trava hostnames oficiais e recusa troca homolog/prod", () => {
    expect(targetUrlError(HOMOLOG_URL, KEEPALIVE_TARGETS.homolog.hostname)).toBe("");
    expect(targetUrlError(PROD_URL, KEEPALIVE_TARGETS.prod.hostname)).toBe("");
    expect(targetUrlError(PROD_URL, KEEPALIVE_TARGETS.homolog.hostname)).not.toBe("");
    expect(targetUrlError(HOMOLOG_URL, KEEPALIVE_TARGETS.prod.hostname)).not.toBe("");
    expect(targetUrlError(`http://${OFFICIAL_HOMOLOG_PROJECT_REF}.supabase.co`, KEEPALIVE_TARGETS.homolog.hostname)).not.toBe("");
    expect(targetUrlError(`https://user:secret@${OFFICIAL_HOMOLOG_PROJECT_REF}.supabase.co`, KEEPALIVE_TARGETS.homolog.hostname)).not.toBe("");
    expect(targetUrlError(`${HOMOLOG_URL}/rest/v1`, KEEPALIVE_TARGETS.homolog.hostname)).not.toBe("");
  });

  it("manda publishable só em apikey e JWT anon também em Bearer", () => {
    expect(isLegacyAnonJwt(PUBLISHABLE)).toBe(false);
    expect(restHeaders(PUBLISHABLE)).toEqual({ apikey: PUBLISHABLE, Accept: "application/json" });
    expect(restHeaders(ANON)).toEqual({
      apikey: ANON,
      Accept: "application/json",
      Authorization: `Bearer ${ANON}`,
    });
  });

  it("recusa secret e service_role", () => {
    expect(privilegedKeyError("sb_secret_nope")).not.toBe("");
    expect(privilegedKeyError(jwtWithRole("service_role"))).not.toBe("");
    expect(privilegedKeyError(ANON)).toBe("");
    expect(() => restHeaders("sb_secret_nope")).toThrow(/secret/i);
  });

  it("loga só alvo e status, sem chave nem body", () => {
    const line = formatKeepaliveLog({ name: "homolog", ok: true, status: 200 });
    expect(line).toBe("keepalive homolog 200");
    expect(formatKeepaliveLog({ name: "prod", ok: false, status: 0 })).toBe("keepalive prod error");
    expect(line).not.toMatch(/sb_|eyJ|Bearer|jobs/i);
  });

  it("consulta jobs?select=id e continua o segundo alvo se o primeiro falhar", async () => {
    const calls = [];
    const fetchImpl = vi.fn(async (url, init) => {
      calls.push({ url, init });
      if (String(url).includes(OFFICIAL_HOMOLOG_PROJECT_REF)) {
        return { status: 401 };
      }
      return { status: 200 };
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const results = await runKeepalive({
      HOMOLOG_SUPABASE_URL: HOMOLOG_URL,
      HOMOLOG_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE,
      PROD_SUPABASE_URL: PROD_URL,
      PROD_SUPABASE_PUBLISHABLE_KEY: ANON,
    }, fetchImpl);
    log.mockRestore();
    expect(results.map((item) => item.ok)).toEqual([false, true]);
    expect(calls[0].url).toBe(`${HOMOLOG_URL}${KEEPALIVE_REST_PATH}`);
    expect(calls[0].init.headers.Authorization).toBeUndefined();
    expect(calls[1].init.headers.Authorization).toBe(`Bearer ${ANON}`);
    expect(JSON.stringify(calls)).not.toMatch(/sb_secret_|service_role/);
  });

  it("não dispara fetch quando a URL está fora da allowlist", async () => {
    const fetchImpl = vi.fn();
    const result = await pingTarget({
      name: "homolog",
      url: "https://evil.example",
      key: PUBLISHABLE,
      fetchImpl,
    });
    expect(result).toEqual({ name: "homolog", ok: false, status: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
