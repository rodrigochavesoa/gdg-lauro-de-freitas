# Sprint 6 — fluxo de candidatura V1 (schema, RPC e rollback)

**História:** S6-01. **Contrato de produto:** [`decisions-applications-v1.md`](decisions-applications-v1.md) (D-08, D-09; merge #20). Perfil mínimo: D-01 em [`decisions-curation-v1.md`](decisions-curation-v1.md).

Ambiente alvo: projeto Supabase de **homologação**. Credenciais só em `docs-local/` (gitignored). Sem `service_role` no browser.

**Fora deste PR:** UI JobDetail/dashboard, Resend, Gemini, deploy, exportação LGPD, visão empresa.

## Ordem de migrations

1. [`202608150001_ai_matching.sql`](../supabase/migrations/202608150001_ai_matching.sql) — `applications` + UNIQUE `(job_id, candidate_id)` + enum de status
2. [`202608160002_seed_fictitious_catalog.sql`](../supabase/migrations/202608160002_seed_fictitious_catalog.sql)
3. [`202608160003_admin_write_grants.sql`](../supabase/migrations/202608160003_admin_write_grants.sql)
4. [`202608160004_curation_enums.sql`](../supabase/migrations/202608160004_curation_enums.sql)
5. [`202608160005_curation_schema.sql`](../supabase/migrations/202608160005_curation_schema.sql)
6. [`20260907041723_application_snapshot_rpc.sql`](../supabase/migrations/20260907041723_application_snapshot_rpc.sql) — **este PR**

Aplicar **somente via CLI** no projeto de teste já linkado (`npx supabase db push --linked --include-all --yes`). Não usar SQL Editor como caminho da história.

No-ops locais `*_noop.sql` (histórico remoto 192301/192306) **não** entram no Git.

## Schema entregue

### Coluna `applications.snapshot`

| Coluna | Tipo | Notas |
|---|---|---|
| `snapshot` | `jsonb not null default '{}'` | Payload D-08 gravado **no apply**. Não muda se o candidato editar o perfil depois. |

Formato persistido pela RPC:

```json
{
  "full_name": "…",
  "email": "conta Auth",
  "skills": ["…"],
  "preferences": { "experience_level": "junior", "work_model": "remote", "location": "…", "linkedin": null, "github": null, "cv_url": null },
  "bio": "… ou null",
  "linkedin": "só se preenchido no perfil",
  "github": "só se preenchido",
  "cv_url": "só se preenchido"
}
```

`candidate_id` e `role` **não** vêm do cliente. `candidate_id` é sempre `auth.uid()`.

### RPCs (único caminho do candidato)

| Função | Quem | Efeito |
|---|---|---|
| `apply_to_job(p_job_id)` | `authenticated` | Sessão + perfil D-01 completo + vaga `approved` + ausência do par → `submitted` + snapshot |
| `withdraw_application(p_job_id)` | `authenticated` | Própria linha `submitted`\|`reviewing` → `withdrawn` **somente** se a vaga está `approved` |

Pré-condições do apply (recusa no servidor):

1. `auth.uid()` presente; e-mail em `auth.users`.
2. `profiles.id = auth.uid()` e `profile_meets_d01` (nome, e-mail, nível, ≥1 skill, localidade, modalidade).
3. `jobs.status = approved`.
4. UNIQUE `(job_id, candidate_id)` — segunda tentativa: `already applied` (inclusive após `withdrawn`).

Retirada (D-09): sem editar snapshot, sem reenviar, sem reabrir `withdrawn`/`rejected`/`accepted`. Transições empresa (`reviewing`/`accepted`/`rejected`) ficam para admin via RLS, fora da UI V1.

Erros estáveis (mensagem):

| Mensagem | Quando |
|---|---|
| `authentication required` | Sem sessão / sem e-mail Auth |
| `profile incomplete` | D-01 incompleto ou sem linha em `profiles` |
| `job not found` | UUID inexistente |
| `job is not approved` | Apply ou withdraw com vaga ≠ `approved` |
| `already applied` | Par já existe |
| `application not found` | Withdraw sem linha própria |
| `cannot withdraw application` | Status ∉ `{submitted, reviewing}` |

### RLS e grants

- **SELECT:** inalterado — candidato vê as próprias linhas; admin vê todas (`is_admin()`).
- **INSERT/UPDATE/DELETE direto:** só `is_admin()`. Candidato **não** insere nem atualiza pela Data API.
- `GRANT INSERT, UPDATE, DELETE` em `applications` para `authenticated` existe para o admin autenticado; o RLS bloqueia o candidato.
- `GRANT EXECUTE` das RPCs só para `authenticated` (revogado de `PUBLIC` e `anon`; default privileges do Supabase concedem `EXECUTE` a `anon` na criação).
- `profile_meets_d01` não é executável pelo browser (`REVOKE` de `PUBLIC`, `anon` e `authenticated`).

Funções de escrita são `SECURITY DEFINER` com `search_path = public`, no mesmo padrão da curadoria (`submit_curation_review`). Sem `service_role` no cliente.

## Usuários de teste

Mesmos arquivos do Sprint 4. Candidato **obrigatório** para S6-01:

| Papel | Arquivo |
|---|---|
| `admin` | `docs-local/admin-test-user.md` |
| `candidate` | `docs-local/candidate-test-user.md` |

`pnpm test:rls` **falha** se os cenários 3–9 (curadoria) ou 10–12 (apply) forem ignorados.

## Cenários `test:rls` (S6-01)

| # | O que valida |
|---|---|
| 10 | Apply em vaga seed `approved`; `submitted`; snapshot com nome/e-mail/skills/preferences; `candidate_id = auth.uid()`; snapshot congelado após editar perfil; UNIQUE recusa o segundo apply |
| 11 | Anon sem RPC; pending recusado; D-01 incompleto recusado; INSERT direto do candidato recusado |
| 12 | `submitted` → `withdrawn`; sem reabrir/reenviar; `reviewing` → `withdrawn`; `accepted` recusado; withdraw com vaga pending recusado; UPDATE direto do candidato recusado |

Limpeza: admin apaga linhas de teste nas vagas seed `0003`, `0004` e `0005`.

## Validação local

```powershell
pnpm lint
pnpm test
pnpm test:rls
pnpm run build
```

## Rollback da migration `20260907041723`

Executar **após** backup do ambiente de teste. Não apaga linhas de `applications`; só remove a coluna e as funções desta entrega e restaura as policies de escrita do candidato (estado 0001).

```sql
drop policy if exists "Candidaturas: inserção administrativa" on public.applications;
drop policy if exists "Candidaturas: atualização administrativa" on public.applications;
drop policy if exists "Candidaturas: exclusão administrativa" on public.applications;

revoke insert, update, delete on public.applications from authenticated;

create policy "Candidaturas: criação própria" on public.applications
  for insert
  with check (
    candidate_id = auth.uid()
    and exists (select 1 from public.jobs where id = job_id and status = 'approved')
  );

create policy "Candidaturas: atualização própria" on public.applications
  for update
  using (candidate_id = auth.uid() or public.is_admin())
  with check (candidate_id = auth.uid() or public.is_admin());

drop function if exists public.apply_to_job(uuid);
drop function if exists public.withdraw_application(uuid);
drop function if exists public.profile_meets_d01(text, text, text[], jsonb);

alter table public.applications drop column if exists snapshot;
```

## Referências

- [`decisions-applications-v1.md`](decisions-applications-v1.md) — D-08 / D-09
- [`s4-curation-flow.md`](s4-curation-flow.md) — padrão RPC + RLS
- [`scripts/check-rls.mjs`](../scripts/check-rls.mjs) — cenários 10–12
- Inventário [P-11](lgpd-data-inventory.md) / [P-12](lgpd-data-inventory.md) — linha de candidatura e `cv_url` no snapshot; base legal = DPO
