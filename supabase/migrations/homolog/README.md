# Migrations de homologação

O Supabase CLI (`supabase db push`, `supabase migration up`, `supabase db reset`) aplica somente os `*.sql` da **raiz** de `supabase/migrations/`. Esta subpasta fica fora desse path.

Aqui entram arquivos homolog-only: sufixo `_homolog.sql`, seed fictício (`seed_fictitious`) e o prefixo legado `avatars_`. Produção não aplica esta pasta. A lista autorizada de produção continua em `../prod.manifest.json`.

`pnpm migrations:homolog` imprime a cadeia completa em ordem de timestamp (manifesto + Camada B da raiz + estes arquivos) e não conecta em banco.
