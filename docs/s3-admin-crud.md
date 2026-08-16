# S3-01 — Auth admin e CRUD de empresas/vagas

Ambiente de **teste**. Empresas e vagas são fictícias. Sem `service_role` no browser. Credenciais do admin de homologação ficam só em `docs-local/` (gitignored).

## Schema usado

| Tabela | Operação admin | Notas |
|---|---|---|
| `companies` | `SELECT`, `INSERT`, `UPDATE` | Policy `Empresas: gestão administrativa` (`is_admin()`) |
| `jobs` | `SELECT`, `INSERT`, `UPDATE` | Policy `Vagas: gestão administrativa`; `SELECT` público só `status = 'approved'` |
| `profiles` | `SELECT` próprio | `role = 'admin'` no usuário de teste |

Campos obrigatórios na UI/API: título, descrição, empresa (existente ou nome novo), nível (`intern`/`junior`/`mid`/`senior`), modelo (`remote`/`hybrid`/`onsite`). Novas vagas enviam **sempre** `status = 'pending'`. Tipo de contrato (CLT/PJ) permanece visual e **não** é persistido (coluna inexistente).

Migration desta entrega: [`supabase/migrations/202608160003_admin_write_grants.sql`](../supabase/migrations/202608160003_admin_write_grants.sql) — `GRANT INSERT/UPDATE/DELETE` em `companies` e `jobs` para `authenticated`. As policies da `202608150001` já restringem escrita a `is_admin()`.

## RLS

| Ator | `jobs` | `companies` |
|---|---|---|
| Anon | Só `approved` | Leitura pública |
| Candidato autenticado | Só `approved`; **INSERT negado** | Leitura; escrita negada |
| Admin (`profiles.role = 'admin'`) | `pending` + `approved`; INSERT/UPDATE | INSERT/UPDATE |

Validação: `pnpm test:rls` (anon + sessão admin via `docs-local/admin-test-user.md` ou `ADMIN_TEST_EMAIL` / `ADMIN_TEST_PASSWORD` no `.env.local`, **sem** prefixo `VITE_`).

## Rollback

```sql
revoke insert, update, delete on public.companies from authenticated;
revoke insert, update, delete on public.jobs from authenticated;
```

Não reverte a schema `202608150001`. Vagas/empresas criadas na UI de teste podem ser apagadas no SQL Editor (dados fictícios).

## Fora desta entrega

Aprovação/rejeição (Sprint 4), Google OAuth (Sprint 5), Gemini, Storage, deploy.
