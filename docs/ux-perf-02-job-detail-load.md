# UX-PERF-02 — Baseline load `/jobs/:id`

**Data:** 2026-09-08 · **Ambiente:** `http://localhost:5173` · seed `b2b2b2b2-0001-4000-8000-000000000001`  
**Ferramenta:** `pnpm qa:job-detail` → [`scripts/measure-job-detail.mjs`](../scripts/measure-job-detail.mjs) (Playwright; 5 runs; sem `networkidle`)  
**Spot-check:** Playwriter headless anon cold ready ≈ 576–585 ms (3 runs)

## Pergunta

PO reportou detalhe mais lento após UX-JOBS-01 (chrome pontilhado). Medir se é regressão de dados/rede ou percepção visual.

## Números (anon)

| Cenário | ready (ms) | mediana | `"Carregando vaga…"` | `rest/v1` jobs |
|---|---|---|---|---|
| Cold `goto /jobs/:id` | 658, 525, 514, 1027, 512 | **525** | 5/5 | ~264–403 ms |
| Click card (catálogo quente) | 980, 950, 384, 379, 384 | **384** | 5/5 | ~271–620 ms |

`status=ready` ≈ botão “Voltar para vagas” visível (conteúdo do detalhe montado).

## Logado (apply check)

Não medido com sessão OAuth neste script (candidato homolog = Google). Código atual (`JobDetailRoute`):

- `loadApprovedJob` + `loadMyApplication` **já disparam em paralelo** (UX-PERF-01).
- UI só sai de `"Carregando vaga…"` quando **job** resolve — apply check não alonga o gate principal.
- Enquanto apply pendente: “Verificando candidatura…” (sem flash azul).

## Causa raiz

| Hipótese | Veredito |
|---|---|
| CSS UX-JOBS-01 (pontilhado / footer) | **Descartada** como causa de centenas de ms — paint spot ~576 ms; waterfall dominante é `jobs` REST |
| Rede Supabase `loadApprovedJob` | **Principal** — SELECT detalhe (`JOB_DETAIL_SELECT`) a cada visita |
| Falta cache ao sair da home | **Confirmada** — `peekApprovedJobsCache()` alimenta só a lista; `loadApprovedJob()` **nunca** consulta o cache; from-home ainda mostra loading + novo `rest/v1/jobs` |
| Waterfall sequencial job→apply | **Não** (já paralelo); apply não bloqueia `status=ready` |
| Percepção só visual | **Parcial** — loading textual + espera de rede ~0,4–0,5 s; chrome novo pode tornar a espera mais saliente, sem piorar o caminho de dados |

## Conclusão

**Não há regressão de dados atribuível a UX-JOBS-01.** Latência observada é o custo esperado do fetch de detalhe + gate `"Carregando vaga…"`.

**Sem fix de produto neste PR** — só baseline + script repetível.

### Follow-up opcional (backlog, não bloqueia)

1. Reusar entrada do cache da home para paint otimista (título/empresa) enquanto o SELECT detalhe completa — ou skeleton no lugar do texto.
2. Medir candidato logado com Playwriter sessão OAuth (T apply settled).

## Como repetir

```powershell
pnpm dev   # localhost:5173
pnpm qa:job-detail
# opcional:
# $env:JOB_ID="…"; $env:MEASURE_RUNS="5"; $env:BASE_URL="http://localhost:5173"
```
