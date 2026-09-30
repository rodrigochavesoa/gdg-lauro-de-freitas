# SLO operacional de homolog

Método e tetos provisórios de latência da SPA no **homolog**. Não é SLO de Production, não autoriza `db push` e não liga alerta. A amostra prevista é pequena. Percentil nearest-rank: índice `ceil(p × n) − 1`. Com n = 5, o p95 é a maior amostra.

**Cold** aqui é cache em memória da aba frio (reload ou primeira ida à rota nessa aba). Os scripts reutilizam o contexto do navegador e, no candidato e no staff, a sessão já autenticada. Não é a primeira visita de um navegador sem cookie nem sem sessão.

`ops.*` (MVP-014, `src/lib/ops-observability.js`) continua só no console e não ganha fluxo novo. A medição lê esses eventos e guarda `event_name`, rota, ação, outcome, `error_class` e `correlation_id` já emitidos. Não cria outro id. Hit/miss vem dos contadores de `peek` no probe `__gdgMeasure`, instalado só em `pnpm dev`. Ausência de `rest/v1` não conta como hit. A política de TTL está em `docs/tech/CACHE-POLICY.md`. O prefetch do shell está em `docs/tech/APP-SHELL-BOUNDARIES.md`.

O hostname de homolog está fixo em `scripts/measure-target.mjs` como allowlist fail-closed. É exceção explícita à fronteira de `docs-local/`: não é segredo e não pode virar destino livre, senão um Vite local enviaria senha ou sessão de teste a outro projeto. O restante da configuração de squad continua local.

A evidência de uma rodada (SHA, horários, latências, payloads, status HTTP, falhas sem resposta, cache e correlation ids) fica em `docs-local/`. Este arquivo guarda o método e os critérios.

## Como classificar uma rodada

| Status | Significado |
|---|---|
| `medido` | Há o n da linha, o marco foi alcançado em todas as amostras e o p95 cabe no limite |
| `fora do teto` | Há o n da linha e o marco é válido, mas o p95 passa do limite. O limite permanece |
| `herdado` | Estudo anterior, citado no doc local, sem repetir a bateria |
| `hipótese` | Amostra insuficiente, marco não confirmado, ou relógio que não é o marco de UI |

O parágrafo do detalhe só entra no percentil se `.content-block p` ficar visível. Sem esse marco a amostra é inválida e não vira latência. Se alguma amostra da linha ficar inválida, a linha é `hipótese`.

`exit 0` do script significa que a bateria terminou e gravou os JSON. Não significa que todo p95 coube no teto.

Cada arquivo da rodada grava `runStartedAt`, `measuredAt` na hora em que o JSON é escrito e, no fim, `runFinishedAt`. Sessão staff AAL2 e candidato de teste ficam em `.env.local` / `docs-local/`. Nenhum segredo entra no Git.

Cada chamada `rest/v1` ou `auth/v1` entra no artefato com caminho, status e bytes. Status `>= 400` vai para `httpErrors`. Pedido sem resposta vai para `networkErrors`, só com o caminho e `net::ERR_*`.

## Critérios

Marco útil. O limite provisório é teto de homolog, não um objetivo de Production. Staff é cold e warm, n = 5, relógio até o heading.

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
| `/admin` | heading “Painel”, cold | 5 | 2,0 s |
| `/admin` | heading “Painel”, SPA quente | 5 | 800 ms |
| `/admin/curadoria` | heading da fila, cold | 5 | 2,0 s |
| `/admin/curadoria` | heading da fila, SPA quente | 5 | 800 ms |
| `/admin/vagas` | heading da gestão, cold | 5 | 2,0 s |
| `/admin/vagas` | heading da gestão, SPA quente | 5 | 800 ms |
| `/admin/ingestao` | heading da ingestão, cold | 5 | 2,0 s |
| `/admin/ingestao` | heading da ingestão, SPA quente | 5 | 800 ms |

O relógio de staff para no heading. `waitForTimeout(800)` vem depois e não entra no percentil.

O remount de candidaturas ainda pede `applications` porque a página, se já há cache, chama `loadMyApplications` com `forceRefresh`. A UI não volta ao skeleton. Isso está alinhado ao código atual.

Não há `EXPLAIN` nesta história. O estudo herdado do aggregate fica no doc local do item 3 do gate.

## Como rodar

Medição manual, fora do CI.

```text
pnpm dev
pnpm qa:ops-perf-slo -- --check
pnpm qa:ops-perf-slo
```

`BASE_URL` default `http://127.0.0.1:5173`. Só loopback (`127.0.0.1`, `localhost` ou `::1`), e a página aberta tem de estar na origem exata, com a mesma porta, antes de injetar sessão ou preencher senha. `http://[::1]:5173` vale; a sessão só é gravada se `location.origin` for essa origem. `VITE_SUPABASE_URL` tem de ser o hostname https exato de homolog. Além do arquivo, a página em execução expõe a URL compilada no probe de dev; se não for esse hostname, o script para antes da senha. O check falha sem chave publishable/anon, sem sessão staff (`ADMIN_EMAIL` / `ADMIN_PASSWORD` ou `docs-local/admin-test-user.md`) ou sem candidato de teste.

`MEASURE_RUNS` default 5, inteiro de 1 a 20. Fora disso a rodada encerra antes do login. O orquestrador grava `MEASURE_LABEL=after` e um id da rodada nos filhos. JSON de candidaturas, detalhe ou staff com outro id é recusado, para não reaproveitar `metrics-after.json` antigo. Portal, catálogo, detalhe, candidaturas e as quatro rotas staff precisam desse n em cold e warm.

O orquestrador não reimplementa o Playwright de detalhe, candidaturas e listas staff. Ele mede `/` e `/vagas` e em seguida chama `scripts/measure-staff-lists.mjs`, `measure-job-detail.mjs` e `measure-my-applications.mjs`. A lista do catálogo é `/vagas`; `/` é o portal.

Comandos avulsos usam o mesmo preflight, cada um no próprio processo: `pnpm qa:job-detail`, `pnpm qa:my-applications`, `pnpm qa:staff-lists`, `pnpm qa:admin-nav`. O orquestrador não cobre quem os executa direto.

## Próxima ação

A rodada vigente classifica `/` quente como `fora do teto`. O limite de 250 ms permanece. A próxima ação é repetir essa rota e inspecionar a amostra lenta; uma rodada não autoriza subir o teto. O número está em `docs-local/decision-ops-perf-slo-homolog.md`.

Nenhuma migration nesta história. Repetir a matriz quando o catálogo de homolog deixar de caber numa resposta pequena, ou quando um SLO de Production for decidido à parte. O item 6 do gate de Production continua com o Plan; esta página só registra o método e os tetos provisórios de homolog.
