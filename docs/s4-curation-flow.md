# Sprint 4 — fluxo de curadoria V1 (schema e rollback)

**História:** S4-01. **Contrato de produto:** [`decisions-curation-v1.md`](decisions-curation-v1.md) (após merge da governança #12).

Ambiente alvo: projeto Supabase de **homologação**. Seed fictício; credenciais operacionais só em `docs-local/` (gitignored).

## Ordem de migrations

1. [`202608150001_ai_matching.sql`](../supabase/migrations/202608150001_ai_matching.sql)
2. [`202608160002_seed_fictitious_catalog.sql`](../supabase/migrations/202608160002_seed_fictitious_catalog.sql)
3. [`202608160003_admin_write_grants.sql`](../supabase/migrations/202608160003_admin_write_grants.sql)
4. [`202608160004_curation_enums.sql`](../supabase/migrations/202608160004_curation_enums.sql)
5. [`202608160005_curation_schema.sql`](../supabase/migrations/202608160005_curation_schema.sql) — **este PR**

Aplicar **somente via CLI** no projeto de teste já linkado (`npx supabase db push --linked --include-all --yes`). Não usar SQL Editor como caminho da história.

O remoto já tinha versões `20260816192301` e `20260816192306` (enums `curator`/`moderator`/`rejected`, sem arquivos no repositório). `db push` sem alinhamento retorna `LegacyDbPushMissingLocalError`. No-ops **locais** (não commitados) com esses timestamps + `--include-all` aplicaram **0004** (`ADD VALUE IF NOT EXISTS`) e **0005**.

## Schema entregue

### Enum e papéis

| Tipo | Valores novos |
|---|---|
| `job_status` | `rejected` (além de `pending`, `approved`, `archived`) |
| `user_role` | `curator`, `moderator` (além de `candidate`, `admin`) |
| `curation_decision` | `approve`, `reject` |
| `job_priority` | `normal`, `urgent` |

`needs_moderation` **não** é status. Sinal derivado pela view `jobs_needing_moderation`.

### Colunas em `jobs`

| Coluna | Tipo | Notas |
|---|---|---|
| `submitted_by` | `uuid` → `profiles`, nullable | Novas vagas: trigger `jobs_set_submitted_by` grava `auth.uid()`; cliente não controla |
| `curation_round` | `integer >= 1`, default `1` | Incrementada em `resubmit_job_for_curation` |
| `priority` | `job_priority`, default `normal` | Só admin via RPC |
| `priority_reason` | `text`, nullable | Obrigatório quando `urgent` (CHECK + RPC) |
| `rejected_at` | `timestamptz`, nullable | Preenchido ao atingir `rejected` |

### Tabela `job_curation_reviews` (append-only)

| Coluna | Notas |
|---|---|
| `decision` | `approve` \| `reject` |
| `rubric_code` | Obrigatório, não vazio |
| `internal_comment` | Opcional |
| UNIQUE | `(job_id, curation_round, reviewer_id)` |

Sem policy de INSERT/UPDATE/DELETE para `authenticated`. Escrita **somente** via RPC `submit_curation_review` (`SECURITY DEFINER`).

### RPCs (único caminho de decisão)

| Função | Quem | Efeito |
|---|---|---|
| `submit_curation_review(job_id, decision, rubric_code, comment?)` | curator / moderator / admin | Registra parecer, aplica quórum, bloqueia duplicidade e autoavaliação |
| `resubmit_job_for_curation(job_id)` | admin | `rejected` → `pending`, `curation_round + 1`, histórico preservado |
| `set_job_curation_priority(job_id, priority, reason?)` | admin | `urgent` exige motivo |

Quórum na rodada corrente:

- 2× `approve` → `approved` + `approved_at`
- 2× `reject` → `rejected` + `rejected_at`
- 1×1 → permanece `pending`; view `jobs_needing_moderation`; moderador/admin decide na RPC

### RLS e grants

- Anônimo: somente vagas `approved` (inalterado).
- Candidato: não cura; não lê pareceres; não altera status/prioridade (colunas sensíveis revogadas no UPDATE).
- Curador/moderador/admin: leem fila `pending` e pareceres via `can_review_curation()`.
- UPDATE em `jobs.status`, `curation_round`, `priority`, `submitted_by`, timestamps de decisão: **revogado** para `authenticated`.

## Dados legados (seed)

Vagas do seed em [`202608160002_seed_fictitious_catalog.sql`](../supabase/migrations/202608160002_seed_fictitious_catalog.sql) permanecem com `submitted_by = NULL` (inseridas sem sessão). Implicações:

- Autoavaliação por `submitted_by` não se aplica a essas vagas até haver reenvio ou recriação autenticada.
- Curadores podem revisar vagas legadas normalmente.
- Documentar no ambiente de teste; em produção futura, backfill opcional com UUID de admin conhecido se necessário.

## Usuários de teste

Criar/atualizar via CLI (`projects api-keys` só em memória) + Auth Admin API; papéis em `profiles.role`. Credenciais só em `docs-local/` (modelos em `docs-local.example/`). Nunca `service_role` no browser nem no Git.

| Papel | Arquivo |
|---|---|
| `admin` | `docs-local/admin-test-user.md` |
| `curator` | `docs-local/curator-test-user.md` |
| `curator` (2º) | `docs-local/curator2-test-user.md` |
| `curator` (3º) | `docs-local/curator3-test-user.md` — bloqueio no empate (cenário 7) |
| `moderator` | `docs-local/moderator-test-user.md` |
| `candidate` | `docs-local/candidate-test-user.md` |

`pnpm test:rls` **falha** se os cenários 3–9 forem ignorados.

## Validação local

```powershell
pnpm lint
pnpm test
pnpm test:rls
pnpm run build
```

## Rollback das migrations 0004–0005

Executar **após** backup do ambiente de teste. Não remove enums novos (limitação Postgres); reverte objetos e colunas desta entrega.

```sql
-- Policies e view
drop policy if exists "Vagas: leitura fila curadoria" on public.jobs;
drop policy if exists "Vagas: leitura pública approved" on public.jobs;
drop policy if exists "Pareceres: leitura interna" on public.job_curation_reviews;

create policy "Vagas aprovadas: leitura pública"
  on public.jobs for select
  using (status = 'approved' or public.is_admin());

-- Restaurar UPDATE amplo em jobs (estado pós-0003)
revoke update on public.jobs from authenticated;
grant insert, update, delete on public.jobs to authenticated;

drop view if exists public.jobs_needing_moderation;

drop trigger if exists jobs_before_insert_submitted_by on public.jobs;
drop function if exists public.jobs_set_submitted_by();
drop function if exists public.submit_curation_review(uuid, public.curation_decision, text, text);
drop function if exists public.resubmit_job_for_curation(uuid);
drop function if exists public.set_job_curation_priority(uuid, public.job_priority, text);
drop function if exists public.can_review_curation();
drop function if exists public.is_moderator();
drop function if exists public.is_curator();

drop table if exists public.job_curation_reviews;

alter table public.jobs
  drop constraint if exists jobs_priority_reason_chk,
  drop column if exists rejected_at,
  drop column if exists priority_reason,
  drop column if exists priority,
  drop column if exists curation_round,
  drop column if exists submitted_by;

drop type if exists public.job_priority;
drop type if exists public.curation_decision;

-- Vagas que chegaram a rejected precisam ser corrigidas manualmente antes do rollback em produção.
-- Valores 'rejected', 'curator', 'moderator' nos enums permanecem (ADD VALUE não é revertível).
```

## Referências

- [`s4-curation-execution-guide.md`](s4-curation-execution-guide.md) — casos de teste 1–9
- [`s2-catalog-rls.md`](s2-catalog-rls.md) — baseline anon do Sprint 2
- [`scripts/check-rls.mjs`](../scripts/check-rls.mjs) — validação reproduzível
