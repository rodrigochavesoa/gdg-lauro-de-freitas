# Migrations de homologação

O Supabase CLI (`supabase db push`, `supabase migration up`, `supabase db reset`) aplica somente os `*.sql` da **raiz** de `supabase/migrations/`. Esta subpasta fica fora desse path.

Aqui entram arquivos homolog-only: sufixo `_homolog.sql`, seed fictício (`seed_fictitious`) e o prefixo legado `avatars_`. Produção não aplica esta pasta. A lista autorizada de produção continua em `../prod.manifest.json`.

`pnpm migrations:homolog` imprime a cadeia completa em ordem de timestamp (manifesto + `../held/` + estes arquivos). `pnpm migrations:homolog:apply` aplica o que ainda não está em `supabase_migrations.schema_migrations`, exige `HOMOLOG_SUPABASE_PROJECT_REF` e não coloca a senha na linha de comando.
