# Política de cache em memória

Caches do browser são `Map` + TTL no processo da aba. Não há Redis, service worker nem cache de CDN de API. Autorização e RLS **não** leem estes mapas: cada request segue com a sessão do Supabase. Um hit só evita repetir uma leitura que o banco já autorizou.

O módulo `src/lib/client-cache/` guarda `{ data, fetchedAt }`, deduplica inflight e oferece `invalidateKey` / `invalidatePrefix`. As APIs públicas (`peek*`, `invalidate*`) continuam nos módulos de domínio.

## Freshness

| Domínio | TTL | Chave | Invalidação | O que não é cache |
|---|---|---|---|---|
| Catálogo de vagas aprovadas | 30 s | JSON de busca, stack, nível, modelo, ordenação, país, local e faixa salarial. Página 2+ faz merge por id na mesma chave; resposta atrasada não substitui ids já vistos. | `invalidateApprovedJobsCache()` após revisão/reenvio de curadoria, update cujo status devolvido é `approved`, e evento realtime de `jobs` com status `approved` (novo ou anterior). | Detalhe da vaga (`loadApprovedJob`) vai à rede. Authz da vaga é `status = approved` no PostgREST. |
| Candidaturas do usuário | 30 s | `userId`, só a página 1 | apply, withdraw, logout e troca de `userId` | Página > 1 não entra no mapa. |
| Privacidade | 30 s | `userId` | `savePrivacyDecision` (limpa todas as chaves e o flag de schema indisponível), logout e troca de `userId` | Payload `schema-unavailable` não é gravado. |
| Curadoria — fila | 30 s | `scope:página:tamanho` (`pending` ou `rejected`) | Prioridade: só páginas `pending`. Revisão, reenvio, criação/edição pending e ingestão: scopes afetados. Sem id no evento: `invalidateCurationQueueCache()` (fila + detalhes). Logout e troca de usuário limpam a fila inteira. | A página da vaga não está na chave, então o scope inteiro sai. `forceRefresh` ignora o mapa e invalida a geração da leitura anterior. |
| Curadoria — detalhe | 30 s | `jobId` | Revisão, reenvio, edição da vaga, realtime com id, logout e troca de usuário. Prioridade não apaga detalhe. | Rubrica e comentário interno continuam no banco; o mapa não autoriza a fila. |
| Avatar signed URL | 55 min (a URL vale 60 min) | `userId:path` | Troca de foto, logout, troca de `userId` (prefixo) | O bucket é privado. A URL assinada não é permissão de outro usuário. |
| Ingestão (lista e detalhe) | nenhum | — | Sempre rede. Processar ingestão só invalida a fila `pending` de curadoria. | A RPC não publica vaga `approved`. |
| Painel admin (resumo) | nenhum na API | — | `loadAdminDashboardSummary` busca de novo. Se o refresh falha, a UI mantém o último valor (“stale display”). | Não há mapa para invalidar depois de mutação. O número novo aparece no próximo load bem-sucedido. |

Constante compartilhada das listas: `LIST_CACHE_TTL_MS` em `src/lib/client-cache/ttl.js`.

## Logout e troca de usuário

`invalidateSessionCaches(userId)` apaga candidaturas, privacidade e signed URL daquele usuário. Sem `userId`, apaga essas famílias — é o caminho do logout em `App.jsx`. A troca de `userId` na mesma aba limpa o usuário anterior antes do prefetch do próximo.

A fila e o detalhe de curadoria não têm `userId` na chave. Os dois mapas saem por inteiro no logout e na troca de usuário. O catálogo público permanece.

## Geração da leitura

Cada chave tem uma geração. O load captura a geração antes do `await` e só grava se ela ainda for a atual. O contador só cresce: `invalidateKey`, `invalidatePrefix`, `clear` e `forceRefresh` avançam para um número que nenhuma leitura anterior recebeu. Invalidar uma chave sem entrada e sem leitura em voo não grava geração nova no mapa. `clear()` não reaproveita a geração capturada antes do logout.

Entrada fora do TTL é removida no `peek`, no `get` e no `set`. A geração dessa chave sai junto, salvo se ainda houver leitura em voo. O mapa não acumula filtros antigos do catálogo.

## Decisão — TanStack Query

**Manter os Maps.** Não migrar nesta história.

| | Maps atuais | TanStack Query |
|---|---|---|
| Dependência nova | Não | Sim |
| Chave e TTL já testados (página 2, inflight, PII) | Sim | Exige reescrever os loads |
| Invalidação cirúrgica | Explícita neste módulo | `queryKey` + `invalidateQueries`, com o mesmo cuidado de não limpar tudo |
| Métrica de hit/miss | Contadores em memória (`getClientCacheStats`) | Cache do QueryClient, mais um cliente |

Contadores: `noteClientCacheAccess` em cada `peek`. `getClientCacheStats()` devolve `{ [nome]: { hit, miss } }`. Não há dashboard. Autorização não consulta esses números.

Migrar só com uma métrica de hit/miss em uso real que mostre custo maior do que o ganho de um cliente a mais, e com decisão nova neste documento.

## Fora desta política

Redis, CDN de borda, service worker e BFF. `OPS_FLOWS` não ganha um fluxo de cache.
