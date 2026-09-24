# Camada B — fora do path do CLI

O Supabase CLI aplica somente os `*.sql` da raiz de `supabase/migrations/`. Esta subpasta não entra em `supabase db push`.

Aqui ficam migrations com o marker «Produção: não aplicar». Elas não estão em `prod.manifest.json`. Promoção para o manifesto exige Sim do PO/Plan.

Homologação as inclui na cadeia de `pnpm migrations:homolog:apply`.
