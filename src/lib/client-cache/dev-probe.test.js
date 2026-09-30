import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryCache } from "./store.js";
import { resetClientCacheStats } from "./stats.js";
import { installClientCacheProbe } from "./dev-probe.js";

describe("probe de medição local", () => {
  beforeEach(() => {
    resetClientCacheStats();
  });

  it("em dev expõe contadores e a URL compilada, sem instalar fora de dev", () => {
    const prod = {};
    installClientCacheProbe(prod, { dev: false, supabaseUrl: "https://example.supabase.co" });
    expect(prod.__gdgMeasure).toBeUndefined();

    const dev = {};
    installClientCacheProbe(dev, { dev: true, supabaseUrl: "https://example.supabase.co" });
    const cache = createMemoryCache({ ttlMs: 1000, name: "catalog" });
    expect(cache.peek("missing")).toBeNull();
    cache.set("ready", { jobs: [] });
    expect(cache.peek("ready")).toEqual({ jobs: [] });
    expect(dev.__gdgMeasure.cacheStats().catalog).toEqual({ hit: 1, miss: 1 });
    expect(dev.__gdgMeasure.supabaseUrl()).toBe("https://example.supabase.co");
  });
});