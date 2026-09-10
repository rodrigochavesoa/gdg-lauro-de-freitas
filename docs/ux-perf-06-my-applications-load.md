# UX-PERF-06 — Loading percebido em `/minhas-candidaturas`

**Data:** 2026-09-09 · **Ambiente:** `http://127.0.0.1:5173` · branch `fix/ux-perf-06-my-applications-load`  
**Ferramenta:** `pnpm qa:my-applications` → [`scripts/measure-my-applications.mjs`](../scripts/measure-my-applications.mjs) (Playwright terminal; 5 runs; sem `networkidle`; **não MCP**)  
**Sessão:** candidato de homologação (`docs-local/candidate-test-user.md`) — **0 candidaturas** (ready = empty “Você ainda não se candidatou”)

## Pergunta

PO/diagnóstico UX-PERF-01: dashboard lento por **dupla espera** (`authReady` + `getUser` + SELECT `applications` com join) e gates visíveis (`<p>Carregando…</p>` na route, empty “Carregando candidaturas” no componente) a cada remount Header **Vagas → Minhas candidaturas**.

## Números

Relógio: clique **Minhas candidaturas** → empty/card visível. T2 amostra rAF ~800 ms (padrão PERF-ADM-05).

| Cenário | Before (ms) | mediana | After (ms) | mediana | `"Carregando…"` | `"Carregando candidaturas"` |
|---|---|---|---|---|---|---|
| **T1** cold reload `/` → clique | 1812, 1197, 1133, 1543, 1336 | **1336** | 159, 151, 121, 148, 229 | **151** | 0/5 → **0/5** | **5/5 → 0/5** |
| **T2** remount Vagas → Minhas candidaturas | 1111, 555, 695, 1015, 1069 | **1015** | 117, 112, 92, 141, 119 | **117** | 0/5 → **0/5** | **5/5 → 0/5** |

T2 rAF gate hits: before 15–38/49–50 por run · after **0/49–50** em 5/5.

Evidências: [`metrics-before.json`](assets/ux-perf-06/metrics-before.json) · [`metrics-after.json`](assets/ux-perf-06/metrics-after.json) · [`measure-before.log`](assets/ux-perf-06/measure-before.log) · [`measure-after.log`](assets/ux-perf-06/measure-after.log)

Meta numérica (não bloqueia rede fria): T2 mediana **≤500 ms** com cache quente — **117 ms**. Gate remount **0/5**.

## Causa raiz (before)

1. `MyApplicationsRoute` bloqueava em `authReady` com `<p>Carregando…</p>`.
2. `MyApplications` sempre `setStatus("loading")` no mount e pintava o empty **Carregando candidaturas** (sem peek).
3. `loadMyApplications` refazia SELECT + join a cada visita; `getUser` extra quando `userId` já era conhecido.
4. Sem cache TTL / inflight — remount SPA = cold miss de novo.

## Fix (espelha PERF-ADM-05 / UX-PERF-05)

| Padrão | Onde | Aplicação |
|---|---|---|
| Cache TTL 30s + `peek*` + inflight + `forceRefresh` SWR | `jobs-api.js` / `curation-api.js` | `apply-api.js` — `peekMyApplicationsCache(userId)`, `loadMyApplications({ userId, forceRefresh })`, `invalidateMyApplicationsCache` em apply/withdraw |
| Skeleton estático DS-06 | `Home.jsx` `job-card--skeleton-static` | `MyApplications.jsx` — 3 placeholders no cold miss; **sem** empty “Carregando candidaturas” |
| Gate só cold miss | `CurationQueue.jsx` (`loading = !cached`) | Remount com peek (incl. `[]`) → empty/cards no 1º paint; SWR em background |
| Route sem spinner genérico | `JobDetailSkeleton` | Route monta `MyApplications` com `userId` conhecido; `!authReady` usa o mesmo shell+skeleton |
| Prefetch candidato | `App.jsx` `loadApprovedJobs()` | `loadMyApplications({ userId })` quando sessão candidato (não staff); dedupe inflight |

**Não feito:** React Query/SWR npm; RLS/schema; chip de status (Polish P3); Visual QA Playwriter.

## Como repetir

```powershell
pnpm dev   # http://127.0.0.1:5173
$env:BASE_URL="http://127.0.0.1:5173"
$env:MEASURE_LABEL="after"   # ou before
pnpm qa:my-applications
```

Credenciais: `docs-local/candidate-test-user.md` ou `CANDIDATE_TEST_EMAIL` / `CANDIDATE_TEST_PASSWORD` (não commitar).

## Visual QA (próximo agente)

- Candidato logado `/` → **Minhas candidaturas** (cold): h1 estável; skeleton estático se miss; empty legítimo **sem** flash “Carregando candidaturas”
- Remount **Vagas → Minhas candidaturas** (cache ≤30s): empty/cards imediatos; 0× “Carregando…” / “Carregando candidaturas”
- Withdraw atualiza a lista (cache invalida + SWR)
- Light/dark; mobile menu o mesmo `navLinks()`
