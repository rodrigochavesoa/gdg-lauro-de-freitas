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

INSERT direto em `job_ingestions` está revogado para `authenticated`. Sem essa RPC, não há escrita. Conectores externos e Fase B continuam fora de escopo; qualquer conector futuro deve usar esta RPC (ou sucessor) — nunca um hash enviado pelo cliente.

Migrations homolog-only: `20260920010148_job_ingestions_source_contract_homolog.sql` e `20260920020100_job_ingestions_register_rpc_homolog.sql`.

## RLS (homologação)

- Anon: sem GRANT
- Candidato: SELECT vazio; INSERT recusado
- Staff AAL2: SELECT
- Admin AAL2: `register_job_ingestion` (INSERT direto revogado)
- Sem UPDATE/DELETE autenticado (histórico)

Fora de `prod.manifest.json`.
