# Contrato de origem — MVP-013 Fase A

Tabela `job_ingestions` guarda a identidade da entrada. Não mistura pipeline de ingestão com estados de curadoria em `jobs`.

## Camadas de deduplicação

| Camada | Chave | Onde |
|---|---|---|
| MVP-010 | `company_id` + `lower(btrim(title))` | `jobs` — índice existente, inalterado |
| MVP-013 | `source_kind` + `normalized_locator` + `payload_hash` | `job_ingestions` — unique `job_ingestions_source_fingerprint_key` |

As camadas são independentes. Repetir a mesma fonte na 013 é idempotente (mesma linha). Abrir uma vaga staff ainda passa pela 010.

## Colunas

| Coluna | Papel |
|---|---|
| `source_kind` | `manual_fixture` ou `staff_replay` nesta sprint |
| `normalized_locator` | identidade da fonte já normalizada |
| `payload_hash` | SHA-256 hex (64) do JSON canônico, **recalculado no banco** |
| `expires_at` | validade do ciclo; nulo = sem expiração |
| `job_id` | FK opcional; `ON DELETE SET NULL` preserva o histórico |
| `created_at` | append-only |

Expiração **não** apaga ingestão, `jobs` nem `job_curation_reviews`. Catálogo público continua só `jobs.status = approved`. O cliente não escolhe `approved`.

## Normalização do localizador

`manual_fixture` e `staff_replay` usam slug sintético (`fixture:…`, `replay:…`):

1. `trim`
2. colapsar whitespace interno para um espaço
3. `lower`
4. rejeitar vazio; máximo 2048 caracteres

O trigger `job_ingestions_before_write_normalize` aplica a mesma regra no INSERT (`private.normalize_job_ingestion_locator`).

Regras HTTP (`normalizeUrlLocator`) estão documentadas e testadas para um `source_kind` futuro: host em lower, sem userinfo, sem fragmento, sem porta 80/443, sem barra final fora da raiz, query estável e sem `utm_*` / `fbclid` / `gclid` / `mc_eid`. Esse kind **não** entra no CHECK desta sprint.

## Payload canônico

Entram no hash, nesta ordem estável via `JSON.stringify` das chaves já ordenadas em `INGESTION_PAYLOAD_KEYS`: `company_name`, `description`, `level`, `location`, `stack`, `title`, `work_model`.

- `title` e `company_name` são obrigatórios
- `stack` é ordenado
- strings sofrem trim/colapso de espaços
- chaves extras são ignoradas no canônico
- campos de PII/segredo (`email`, `full_name`, `cv`, tokens, etc.) são recusados

Mesmo payload + mesma origem → mesmo fingerprint. Payload diferente na mesma origem → nova linha (ciclo novo), sem apagar a anterior.

## `payload_hash` — camada confiável

O SHA-256 nasce em `private.hash_job_ingestion_payload`, chamado por `public.register_job_ingestion`. O cliente envia `source_kind`, locator e payload; **não** escolhe o digest. `hashIngestionPayload` no JS é só preview/teste e deve coincidir com o canônico do banco.

INSERT direto em `job_ingestions` está revogado para `authenticated`. Sem a RPC, não há escrita. O cliente não escolhe o digest. Conectores externos continuam fora de escopo; qualquer conector futuro deve usar `register_job_ingestion` / `process_job_ingestion` — nunca um hash enviado pelo cliente.

## Fase B — processamento controlado

RPC `process_job_ingestion` (admin AAL2): registra a origem, materializa `jobs` **pending**, grava `job_ingestion_attempts` (append-only) e **nunca** escolhe `approved`.

| Outcome | Significado |
|---|---|
| `materialized` | vaga pending criada e ligada |
| `idempotent` | mesma origem já tinha `job_id`; retry sem duplicar |
| `duplicate_010` | camada MVP-010 (empresa + título) já existia; vaga reaproveitada |
| `failed` | falha redigida (`payload_invalid`, `materialize_failed`); histórico permanece |
| `expired` | `expires_at` passou; não materializa; catálogo público esconde vaga ligada |

**Aceite de falha (Fase B):** só tentativas **depois** do registro da origem. Recusa de contrato (`source_kind` inválido, localizador vazio, payload proibido) falha em `register_job_ingestion` **antes** de existir linha — a UI mostra o erro; **não** há `job_ingestion_attempts` (follow-up `INGEST-ATTEMPT-CONTRACT-01`).

`loadJobIngestions` lê a view `job_ingestion_staff_list` em páginas de 24, sem `canonical_payload` e sem o histórico de tentativas. O detalhe usa `loadJobIngestionDetail`. A contagem do painel usa `count_job_ingestions_needing_attention`.

UI staff: atalho **Ingestão** no painel `/admin` (loading / vazio / erro / reprocessar). Fixture fictícia: `fixture:homolog-acme-frontend`.

Migrations homolog-only: `20260920010148_job_ingestions_source_contract_homolog.sql`, `20260920020100_job_ingestions_register_rpc_homolog.sql`, `20260920040000_job_ingestions_process_homolog.sql` e `20260923140000_job_ingestion_staff_list_homolog.sql`.

## RLS (homologação)

- Anon: sem GRANT
- Candidato: SELECT vazio; INSERT recusado
- Staff AAL2: SELECT
- Admin AAL2: `register_job_ingestion` e `process_job_ingestion` (INSERT direto revogado)
- Tentativas: leitura staff AAL2; sem INSERT autenticado
- Sem UPDATE/DELETE autenticado (histórico)

Fora de `prod.manifest.json`.
