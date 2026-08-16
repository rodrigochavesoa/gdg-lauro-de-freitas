# Sprint 2 — catálogo e RLS (sem segredos)

Ambiente: projeto Supabase **de teste**. Seed e empresas são **fictícios** (`example.invalid`). Nenhum dado pessoal real.

## Como aplicar no projeto de teste

1. Receber URL + publishable key **fora do Git** ([`docs/security-and-documentation.md`](security-and-documentation.md)).
2. Copiar [`.env.example`](../.env.example) para `.env.local` e preencher só localmente.
3. No SQL Editor do Supabase (ou CLI linkado), aplicar nesta ordem:
   - [`supabase/migrations/202608150001_ai_matching.sql`](../supabase/migrations/202608150001_ai_matching.sql)
   - [`supabase/migrations/202608160002_seed_fictitious_catalog.sql`](../supabase/migrations/202608160002_seed_fictitious_catalog.sql)
4. `pnpm test:rls` (usa `.env.local`; não imprime chaves).

Notas operacionais (quem entregou a chave, quando): pasta gitignored `docs-local/` — modelo em [`docs-local.example/`](../docs-local.example/).

## O que o visitante (anon) deve ver

| Recurso | Esperado |
|---|---|
| `jobs` | Somente `status = 'approved'` (4 vagas do seed) |
| Vaga `PENDENTE — não publicar` | Ausente |
| `profiles` / `applications` | Nenhuma linha |
| Home | Cards das 4 vagas aprovadas |

O frontend ainda filtra `.eq("status", "approved")` por defesa em profundidade.

## Candidato e admin

Auth real (Google OAuth) **não** entra neste sprint. Cenários autenticados ficam para o Sprint 5; as policies já estão na migration 0001.

## Rollback do seed

```sql
delete from public.jobs where id in (
  'b2b2b2b2-0001-4000-8000-000000000001',
  'b2b2b2b2-0002-4000-8000-000000000002',
  'b2b2b2b2-0003-4000-8000-000000000003',
  'b2b2b2b2-0004-4000-8000-000000000004',
  'b2b2b2b2-0005-4000-8000-000000000005'
);
delete from public.companies where id in (
  'a1a1a1a1-0001-4000-8000-000000000001',
  'a1a1a1a1-0002-4000-8000-000000000002',
  'a1a1a1a1-0003-4000-8000-000000000003',
  'a1a1a1a1-0004-4000-8000-000000000004'
);
```

Não reverte a schema da 0001.

## Chave usada no frontend

Preferir `VITE_SUPABASE_PUBLISHABLE_KEY`. Fallback: `VITE_SUPABASE_ANON_KEY`. Nunca `service_role` no browser.
