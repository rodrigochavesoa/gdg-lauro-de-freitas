# SLO operacional de homolog

Método e tetos provisórios de latência da SPA no **homolog**. Não é SLO de Production, não autoriza `db push` e não liga alerta. A amostra prevista é pequena. Percentil nearest-rank: índice `ceil(p × n) − 1`. Com n = 5, o p95 é a maior amostra.

**Cold** aqui é cache em memória da aba frio (reload ou primeira ida à rota nessa aba). Os scripts reutilizam o contexto do navegador e, no candidato e no staff, a sessão já autenticada. Não é a primeira visita de um navegador sem cookie nem sem sessão.

`ops.*` (MVP-014, `src/lib/ops-observability.js`) continua só no console. Esta matriz não lê esses eventos e não acrescenta fluxo em `OPS_FLOWS`. Hit/miss de cache não está em `window`; quando o script não chama `getClientCacheStats`, a ausência de um novo `rest/v1` na navegação quente é o sinal usado. A política de TTL e invalidação está em `docs/tech/CACHE-POLICY.md`. O prefetch do shell está em `docs/tech/APP-SHELL-BOUNDARIES.md`.

A evidência de uma rodada (SHA, horários, latências, payloads e status HTTP) fica em `docs-local/`. Este arquivo guarda o método e os critérios.

## Como classificar uma rodada

| Status | Significado |
|---|---|
| `medido` | Há o n da linha e os percentis cabem no limite |
| `herdado` | Estudo anterior, citado no doc local, sem repetir a bateria |
| `hipótese` | Limite ainda sem amostra suficiente, ou relógio que não é o marco de UI |

Cada arquivo da rodada grava `runStartedAt`, `measuredAt` na hora em que o JSON é escrito e, no fim, `runFinishedAt`. Sessão staff AAL2 e candidato de teste ficam em `.env.local` / `docs-local/`. Nenhum segredo entra no Git.

Cada chamada `rest/v1` ou `auth/v1` entra no artefato com caminho, status e bytes. Status `>= 400` também vai para `httpErrors`.

## Critérios

Marco útil. O limite provisório é teto de homolog, não um objetivo de Production. Lista staff com n = 1 é observação pontual: não publicar p50/p95.

| Rota | Marco | n | Limite provisório |
|---|---|---|---|
| `/` | h1 do portal, cold | 5 | 2,0 s |
| `/` | h1 do portal, SPA quente | 5 | 250 ms |
| `/vagas` | “Vagas em destaque”, cold | 5 | 800 ms |
| `/vagas` | idem, SPA quente | 5 | 300 ms |
| `/jobs/:id` | shell (voltar/skeleton), cold | 5 | 500 ms |
| `/jobs/:id` | parágrafo do detalhe, cold | 5 | 1,5 s |
| `/jobs/:id` | h1, clique no card | 5 | 250 ms |
| `/jobs/:id` | parágrafo, clique no card | 5 | 1,2 s |
| `/minhas-candidaturas` | empty/card, cold | 5 | 400 ms |
| `/minhas-candidaturas` | empty/card, remount | 5 | 200 ms |
| `/admin` | RPC `get_admin_dashboard_summary` | 20 | 1,0 s |
| `/admin` | heading “Painel” | 1, sem percentil | observação pontual; o relógio do script não é SLO |
| `/admin/curadoria` | chamada de lista | 1, sem percentil | observação pontual da chamada |
| `/admin/vagas` | chamada de lista | 1, sem percentil | observação pontual da chamada |
| `/admin/ingestao` | chamada de lista | 1, sem percentil | observação pontual da chamada |

O relógio de `pnpm qa:staff-lists` soma `waitForTimeout(800)` depois do texto de settle. Esse relógio não é o tempo até o heading e não vira percentil.

O remount de candidaturas ainda pede `applications` porque a página, se já há cache, chama `loadMyApplications` com `forceRefresh`. A UI não volta ao skeleton. Isso está alinhado ao código atual.

Não há `EXPLAIN` nesta história. O estudo herdado do aggregate fica no doc local do item 3 do gate.

## Como rodar

Medição manual, fora do CI.

```text
pnpm dev
pnpm qa:ops-perf-slo -- --check
pnpm qa:ops-perf-slo
```

`BASE_URL` default `http://127.0.0.1:5173`. Só loopback (`127.0.0.1`, `localhost` ou `::1`), e a página aberta tem de estar na origem exata, com a mesma porta, antes de injetar sessão ou preencher senha. `http://[::1]:5173` vale; a sessão só é gravada se `location.origin` for essa origem. `VITE_SUPABASE_URL` tem de ser o hostname https exato de homolog. O check falha sem chave publishable/anon, sem sessão staff (`ADMIN_EMAIL` / `ADMIN_PASSWORD` ou `docs-local/admin-test-user.md`) ou sem candidato de teste.

`MEASURE_RUNS` default 5. Um valor presente que não seja inteiro positivo encerra a rodada antes do login. O orquestrador só grava os JSON quando portal, catálogo, detalhe e candidaturas têm esse número de amostras. As quatro rotas staff são obrigatórias e continuam observação pontual.

O orquestrador não reimplementa o Playwright de detalhe, candidaturas e listas staff. Ele mede `/` e `/vagas` e em seguida chama `scripts/measure-staff-lists.mjs`, `measure-job-detail.mjs` e `measure-my-applications.mjs`. A lista do catálogo é `/vagas`; `/` é o portal. Os dois scripts de candidato e de detalhe usam a nav “Principal” e `/vagas` por isso.

Comandos avulsos, o mesmo contrato: `pnpm qa:job-detail`, `pnpm qa:my-applications`, `pnpm qa:staff-lists`, `pnpm qa:admin-nav`.

## Próxima ação

Nenhuma migration nesta história. Repetir a matriz quando o catálogo de homolog deixar de caber numa resposta pequena, ou quando um SLO de Production for decidido à parte. O item 6 do gate de Production continua com o Plan; esta página só registra o método e os tetos provisórios de homolog.
