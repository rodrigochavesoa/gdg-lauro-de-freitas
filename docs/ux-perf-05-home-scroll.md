# UX-PERF-05 — Scroll jank na home após `/login` → `/`

**Data:** 2026-09-08 · **Ambiente:** `http://localhost:5173` · branch `fix/ux-perf-05-home-scroll-jank`  
**Ferramenta:** Playwright + PerformanceObserver + timeline PNG (`scripts/measure-home-scroll.mjs`) — **chrome-devtools-mcp offline** nesta sessão (fallback documentado).  
**Base Git:** `main` @ `a68caf6` (UX-JOBS-01). PERF-03/04 **não** incluídos neste PR.

## Repro

1. `pnpm dev` → abrir `http://localhost:5173/login` (sem visitar `/` antes nesta sessão).
2. Aguardar dwell humano curto (~1 s) ou clicar **Vagas** imediatamente.
3. Em `/`, **scroll imediato** (roda) durante load residual e após a lista.
4. Light/dark (ThemeToggle). Desktop ≥1280px.
5. Segunda visita: `/login` → **Vagas** (cache ≤30s) — comparar fluidez.

## Diagnóstico (before)

| Métrica | Valor |
|---|---|
| `.job-card--skeleton` no mount home (frio) | **4** |
| Skeletons durante scroll | **4** |
| Skeletons na 2ª visita (quente) | **0** |
| `rest/v1/jobs` no cenário | 2 |
| Long tasks | **4** · total **370 ms** |
| Frames jank (`dt` > 33 ms) | **8 / 240** |

Evidência: [`docs/assets/ux-perf-05/flame-before.png`](assets/ux-perf-05/flame-before.png) · [`metrics-before.json`](assets/ux-perf-05/metrics-before.json)

**2ª visita:** skeletons 0 — jank perceptível some; confirma **cache frio pós-login**, não regressão permanente do hero CSS.

## Causa raiz confirmada

1. **Primária:** `/login` não aquecia o catálogo. Em `/`, `Home` montava `catalogStatus === "loading"` com **4× `.job-card--skeleton` animados** (`@keyframes job-card-skeleton`) enquanto o usuário já scrollava.
2. **Secundária (mitigada):** shimmer contínuo compete com paint/scroll se o race frio ainda ocorrer.
3. **Descartada como causa principal do “após login”:** gradient do `.hero` isolado — o diferencial frio vs quente bate com `peekApprovedJobsCache` / TTL; 2ª visita fluida sem mudar o hero.

## Plano de fix aplicado

| Item | Mudança |
|---|---|
| Prefetch shell | `App.jsx` chama `loadApprovedJobs()` no mount |
| Dedúpe in-flight | `jobs-api.js` compartilha promise em voo (App + Home) |
| Skeleton estático | Home usa `job-card--skeleton-static` se ainda houver cold race |
| Avatar divider | `loading="lazy"` + `decoding="async"` em `avatar-gdgjobs.png` |

**Não feito:** remover visual do hero; SSR blocking; paginação; PERF-03/04.

## After (mesmo roteiro; dwell ~900 ms em `/login`)

| Métrica | Before | After |
|---|---|---|
| Skeletons no mount | **4** | **0** |
| Skeletons durante scroll | **4** | **0** |
| Skeletons 2ª visita | 0 | 0 |
| Long task total ms | 370 | 355 |
| Jank frames | 8/240 | 8/240 |
| Cards prontos | 4 | 4 |

Evidência: [`docs/assets/ux-perf-05/flame-after.png`](assets/ux-perf-05/flame-after.png) · [`metrics-after.json`](assets/ux-perf-05/metrics-after.json)

**Leitura:** o ganho de produto é **eliminar 4 skeletons animados no path login→home** (prefetch + peek). Contagens de longtask/jank no headless permanecem no mesmo patamar (scripting de navegação/React); sem shimmer no scroll o travamento reportado pelo PO deixa de ocorrer nesse path. Cache quente continua sem skeleton.

## Como repetir

```powershell
pnpm dev
$env:BASE_URL="http://localhost:5173"
$env:MEASURE_LABEL="before"   # ou after
$env:LOGIN_DWELL_MS="900"
node scripts/measure-home-scroll.mjs
```

## Visual QA (próximo agente)

- `/login` → **Vagas** → scroll hero + lista (light/dark)
- Scroll durante load residual (se houver) e após cards
- 2ª visita `/` (cache quente) permanece fluida
- CTA `.cta` some quando logado; filtros/sort/detalhe sem regressão
- Hero DS-06 preservado (light + dark)
