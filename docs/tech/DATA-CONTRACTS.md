# Contratos de dados — UI ↔ PostgREST

Seletores e DTOs das superfícies P1. O código canônico está em `src/lib/data-contracts/`. Este documento é a matriz humana; o teste `src/lib/data-contracts/data-contracts.test.js` recusa drift.

O aplicativo permanece JavaScript. `src/lib/database.types.ts` é gerado e versionado para consulta. `src/lib/supabase-client.js` declara o tipo só em JSDoc (`@typedef {import("./database.types").Database} Database`). Isso não liga um compilador TypeScript ao app.

## Regenerar os tipos

```bash
pnpm types:database
```

Pré-requisito local: `HOMOLOG_DATABASE_URL` no ambiente ou em `.env.local` (não versionar). O script recusa o project ref de produção e não imprime a URL. A saída é o schema `public` do banco **de homolog**.

Tabelas que existem só em homolog (ingestão) aparecem no arquivo gerado porque a fonte é esse schema. Isso **não** promove essas tabelas para `supabase/migrations/prod.manifest.json`.

## Regra

Listas não incluem `description`, `requirements` completos, payloads de ingestão (`canonical_payload`, tentativas, `payload_hash`) nem PII além do necessário (`snapshot` de candidatura fica no detalhe).

Chave ausente no mapper lança `contrato de dados: campo obrigatório ausente (<superfície>.<campo>)`. `null` é valor e passa. O mapeamento visual de `map-job.js` não muda.

O predicado de atenção da ingestão continua em `docs-local/tech/INGEST-ATTENTION-CONTRACT.md` (doc operacional, fora do Git público).

## Matriz

| Superfície | Select | DTO |
|---|---|---|
| Catálogo lista | `JOB_LIST_SELECT` — id, title, stack, level, work_model, location, country_code, salary_*, status, approved_at, created_at, `companies(name)` | `mapCatalogListRowToDto` exige id, title, status; a UI segue com `mapJob` |
| Catálogo lista (busca) | `JOB_LIST_SELECT_SEARCH` — o mesmo, mais `co:companies()` vazio | idem |
| Catálogo detalhe | `JOB_DETAIL_SELECT` — lista + description, requirements, `companies(name, description)` | `mapCatalogDetailRowToDto` exige id, title |
| Catálogo detalhe pesado | `JOB_DETAIL_HEAVY_SELECT` — id, description, requirements, `companies(description)` | `mapCatalogHeavyRowToDto` exige id |
| Admin vagas lista | `ADMIN_JOB_LIST_SELECT` — id, title, status, created_at, level, work_model, `companies(name)` | `mapAdminJobListRowToDto` — esses campos; sem description nem reviews |
| Admin vagas lista (busca) | `ADMIN_JOB_LIST_SELECT_SEARCH` — lista + `co:companies()` | idem |
| Admin formulário | `ADMIN_JOB_SELECT` — lista do form + description, stack, curation_round, rejected_at, company_id, salários, `companies(name)`, `job_curation_reviews(...)` | `mapAdminJobFormRowToDto` exige id, title, status |
| Admin probe de título | `ADMIN_JOB_TITLE_PROBE_SELECT` — id, title, company_id | linha crua |
| Empresas (picker) | `COMPANY_PICKER_SELECT` — id, name | linha crua |
| Curadoria lista | `CURATION_LIST_FIELDS` — id, title, status, priority, curation_round, level, work_model, location, created_at, `companies(name)` | `mapCurationListRowToDto` exige id, title, status |
| Curadoria detalhe | `CURATION_DETAIL_FIELDS` — id, description, stack | `mapCurationDetailRowToDto` exige id |
| Curadoria reviews | `CURATION_REVIEW_FIELDS` — job_id, curation_round, reviewer_id, decision, rubric_code, internal_comment, created_at | linha crua (não é lista de vagas) |
| Curadoria moderação | `CURATION_MODERATION_ID_SELECT` — id | linha crua |
| Ingestão lista | `INGESTION_LIST_SELECT` — id, source_kind, normalized_locator, expires_at, job_id, created_at, payload_title, job_title, job_status, latest_outcome | `mapIngestionListRowToDto` exige id, source_kind, normalized_locator, created_at |
| Ingestão detalhe | `INGESTION_DETAIL_SELECT` — lista + payload_hash, canonical_payload, `jobs(...)`, `job_ingestion_attempts(...)` | linha crua do detalhe |
| Candidaturas lista | `APPLICATION_LIST_SELECT` — id, job_id, candidate_id, status, created_at, updated_at, `jobs(title, companies(name))` | `mapApplicationListRowToDto` exige id, job_id, status; sem snapshot |
| Candidatura detalhe | `APPLICATION_SELECT` — lista + snapshot | linha crua |
| Perfil | `PROFILE_SELECT` — id, full_name, headline, bio, skills, preferences, role, avatar_path | `mapProfileRowToDto` exige id |
| Privacidade finalidades | `PRIVACY_PURPOSE_SELECT` — purpose_code, version, title, specific_description, classification, status, legal_basis_status, retention_status, text_status, revocation_effect, created_at | `mapPrivacyPurposeRowToDto` exige purpose_code, version, title |
| Privacidade eventos | `PRIVACY_EVENT_SELECT` — id, purpose_code, purpose_version, event_type, source, proof, created_at | linha crua |

`specific_description` é coluna de finalidade de privacidade. O teste de tokens trata identificadores inteiros, então não conta como o token `description` das listas de vaga.

## O que o teste garante

- Nenhum `.select("*")` em `src/**/*.js` e `src/**/*.jsx`.
- Cada superfície de `LIST_SURFACES` não contém os tokens proibidos daquela linha.
- Cada superfície de `DETAIL_SURFACES` ainda contém as colunas pesadas (`description`, `requirements`, `canonical_payload`, `snapshot`).
- Mapper de catálogo e de ingestão falha com a mensagem estável quando a chave obrigatória some.

## Fora deste contrato

- Conversão do app React para TypeScript.
- Novas views, RPCs ou migrations só para espelhar o select.
- Predicado de atenção da ingestão (permanece no doc local).
- Apply de schema em Production.
