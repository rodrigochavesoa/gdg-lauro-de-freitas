import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { matchJobsGate } from "./handler.ts";

const root = dirname(fileURLToPath(import.meta.url));
const handlerSource = readFileSync(join(root, "handler.ts"), "utf8");
const entrySource = readFileSync(join(root, "index.ts"), "utf8");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("match-jobs gate", () => {
  it("responde 403 em POST, GET e nos demais métodos, sem chamar a rede", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]) {
      const response = matchJobsGate(new Request("http://local/match-jobs", { method }));
      expect(response.status, method).toBe(403);
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(await response.json()).toEqual({
        error: "Matching indisponível até o gate de privacidade (MVP-005).",
      });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("OPTIONS só devolve o preflight, sem corpo de erro", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = matchJobsGate(new Request("http://local/match-jobs", { method: "OPTIONS" }));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
    expect(response.headers.get("access-control-allow-headers")).toContain("authorization");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("o entrypoint delega ao gate e não lê perfil nem importa o provedor", () => {
    expect(entrySource).toContain("matchJobsGate");
    expect(entrySource).toContain("Deno.serve");
    const sources = `${handlerSource}\n${entrySource}`;
    expect(sources).not.toMatch(/gemini|supabase|headline|bio|skills|preferences|profiles|embed\s*\(/i);
  });
});
