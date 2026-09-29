# SLO operacional de homolog

Baseline de latência da SPA no **homolog**. Não é SLO de Production, não autoriza `db push` e não liga alerta. Amostra pequena, catálogo pequeno. Percentil nearest-rank: índice `ceil(p × n) − 1`. Com n = 5, o p95 é a maior amostra.

`ops.*` (MVP-014, `src/lib/ops-observability.js`) continua só no console. Esta matriz não lê esses eventos e não acrescenta fluxo em `OPS_FLOWS`. Hit/miss de cache não está em `window`; quando o script não chama `getClientCacheStats`, a ausência de um novo `rest/v1` na navegação quente é o sinal usado. A política de TTL e invalidação está em `docs/tech/CACHE-POLICY.md`. O prefetch do shell está em `docs/tech/APP-SHELL-BOUNDARIES.md`.

## O que é medido

| Status | Significado |
|---|---|
| `medido` | Número desta rodada, com o n da tabela |
| `herdado` | Estudo anterior, citado, sem repetir a bateria |
| `hipótese` | Limite ainda sem amostra suficiente, ou relógio que não é o marco de UI |

Ambiente da rodada: Vite local (`pnpm dev`) com Supabase de homolog, SHA de app `7fc3d6e`, 2026-09-29. Sessão staff AAL2 e candidato de teste ficam em `.env.local` / `docs-local/`. Nenhum segredo entra no Git. JSON cru: `docs-local/perf/OPS-PERF-SLO-01/`.

`/admin` depois do shell em `src/app/` ainda chama uma vez `rpc/get_admin_dashboard_summary` (amostra 282 ms, 175 B). O p50/p95 da RPC não foi refeito: 20 chamadas em 2026-09-28, p50 295 ms, p95 794 ms (`docs-local/decision-perf-admin-shell-summary-homolog-slo.md`).

## Rotas P1

Marco útil entre parênteses. Limite provisório é teto de homolog, acima do p95 medido, não um objetivo de Production.

| Rota | Marco | Amostra | p50 | p95 | Pedidos | Payload | Limite provisório | Status |
|---|---|---|---|---|---|---|---|---|
| `/` | h1 do portal, cold | n = 5 | 377 ms | 1,4 s | 1× `jobs` (prefetch) | ~1,7 kB | 2,0 s | medido |
| `/` | h1 do portal, SPA quente | n = 5 | 108 ms | 122 ms | 0× `jobs` | 0 | 250 ms | medido |
| `/vagas` | “Vagas em destaque”, cold | n = 5 | 392 ms | 551 ms | 1× `jobs` | ~1,7 kB | 800 ms | medido |
| `/vagas` | idem, SPA quente | n = 5 | 146 ms | 188 ms | 0× `jobs` | 0 | 300 ms | medido |
| `/jobs/:id` | shell (voltar/skeleton), cold | n = 5 | 328 ms | 344 ms | `jobs` full + list | — | 500 ms | medido |
| `/jobs/:id` | parágrafo do detalhe, cold | n = 5 | 1,05 s | 1,08 s | idem | — | 1,5 s | medido |
| `/jobs/:id` | h1, clique no card | n = 5 | 123 ms | 141 ms | `jobs` heavy | — | 250 ms | medido |
| `/jobs/:id` | parágrafo, clique no card | n = 5 | 876 ms | 904 ms | idem | — | 1,2 s | medido |
| `/minhas-candidaturas` | empty/card, cold | n = 5 | 132 ms | 187 ms | `applications` em 4/5 | — | 400 ms | medido |
| `/minhas-candidaturas` | empty/card, remount | n = 5 | 57 ms | 70 ms | `applications` em 5/5 | — | 200 ms | medido |
| `/admin` | RPC `get_admin_dashboard_summary` | n = 20 | 295 ms | 794 ms | 1 RPC | — | 1,0 s | herdado |
| `/admin` | heading “Painel” | n = 1 | 2,2 s no relógio do script | — | profiles + user + RPC 282 ms / 175 B | — | não usar esse relógio como SLO | hipótese |
| `/admin/curadoria` | lista | n = 1 | — | — | `jobs` 344 ms / 1,8 kB, sem `description`; `jobs_needing_moderation` 2 B | — | chamada de lista 500 ms | medido na chamada; página é hipótese |
| `/admin/vagas` | lista | n = 1 | — | — | `jobs` 355 ms / 1,4 kB, sem `description` | — | chamada de lista 500 ms | medido na chamada; página é hipótese |
| `/admin/ingestao` | lista | n = 1 | — | — | `job_ingestion_staff_list` 362 ms / 828 B, sem payload canônico | — | chamada de lista 500 ms | medido na chamada; página é hipótese |

O relógio de `pnpm qa:staff-lists` soma `waitForTimeout(800)` depois do texto de settle. Os 2,1–2,2 s de página não são o tempo até o heading. A coluna de limite usa `calls[].ms`.

O remount de candidaturas ainda pede `applications` porque a página, se já há cache, chama `loadMyApplications` com `forceRefresh`. A UI não volta ao skeleton. Isso está alinhado ao código atual, não a um miss acidental.

Não há `EXPLAIN` novo. O estudo herdado, com 10 vagas reais e 10 mil linhas desfeitas na mesma transação, já mostrou o aggregate em poucos milissegundos e o seq scan. Esta rodada não tem volume que justifique índice.

## Como rodar

Medição manual, fora do CI.

```text
pnpm dev
pnpm qa:ops-perf-slo -- --check
pnpm qa:ops-perf-slo
```

`BASE_URL` default `http://127.0.0.1:5173`. O check falha sem `VITE_SUPABASE_URL` de homolog, sem chave publishable/anon, sem sessão staff (`ADMIN_EMAIL` / `ADMIN_PASSWORD` ou `docs-local/admin-test-user.md`) ou sem candidato de teste. `MEASURE_RUNS` default 5.

O orquestrador não reimplementa o Playwright de detalhe, candidaturas e listas staff. Ele mede `/` e `/vagas` e em seguida chama `scripts/measure-staff-lists.mjs`, `measure-job-detail.mjs` e `measure-my-applications.mjs`. A lista do catálogo é `/vagas`; `/` é o portal. Os dois scripts de candidato e de detalhe usam a nav “Principal” e `/vagas` por isso.

Comandos avulsos, o mesmo contrato: `pnpm qa:job-detail`, `pnpm qa:my-applications`, `pnpm qa:staff-lists`, `pnpm qa:admin-nav`.

## Próxima ação

Nenhuma migration nesta história. Repetir a matriz quando o catálogo de homolog deixar de ser uma lista de cerca de 2 kB, ou quando um SLO de Production for decidido à parte. O item 6 do gate de Production continua com o Plan; esta página só registra o método e os tetos provisórios de homolog.
