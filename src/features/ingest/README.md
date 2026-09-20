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
| `payload_hash` | SHA-256 hex (64) do JSON canônico |
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

## Limitação Fase A — `payload_hash`

O SHA-256 é calculado no cliente (`hashIngestionPayload`). O banco só exige 64 hex (`^[a-f0-9]{64}$`) e **não** recalcula o digest. Em homologação interna isso é aceitável. Antes de conectores externos ou da Fase B, o hash deve nascer em camada confiável (Edge Function ou pipeline backend).

## RLS (homologação)

- Anon: sem GRANT
- Candidato: SELECT vazio; INSERT recusado
- Staff AAL2: SELECT
- Admin AAL2: INSERT
- Sem UPDATE/DELETE autenticado (histórico)

Migration homolog-only: `20260920010148_job_ingestions_source_contract_homolog.sql`. Fora de `prod.manifest.json`.
