# Sprint 4 — guia de execução da curadoria V1 (`test:rls`)

**História:** S4-01. Schema: [`s4-curation-flow.md`](s4-curation-flow.md). Script: [`scripts/check-rls.mjs`](../scripts/check-rls.mjs).

Ambiente: projeto Supabase de **homologação** já linkado (`npx supabase link`). Credenciais só em `docs-local/` (gitignored); modelos em `docs-local.example/`.

## Contas

| Papel | Arquivo local | Uso |
|---|---|---|
| `admin` | `docs-local/admin-test-user.md` | Cria vagas autenticado (`submitted_by` preenchido); prioridade; reenvio |
| `curator` | `docs-local/curator-test-user.md` | Primeiro parecer |
| `curator` (2º) | `docs-local/curator2-test-user.md` | Quórum, empate e segundo voto |
| `curator` (3º) | `docs-local/curator3-test-user.md` | Curador que **não** votou no empate (bloqueio de moderação) |
| `moderator` | `docs-local/moderator-test-user.md` | Resolve empate sem ter votado na rodada |
| `candidate` | `docs-local/candidate-test-user.md` | Sem fila, RPC nem prioridade |

Seed legado (`submitted_by` NULL) **não** serve para autoavaliação. Os cenários 3–9 criam vagas **autenticadas como admin**.

## Cenários (`pnpm test:rls`)

| # | Quem | Esperado |
|---|---|---|
| 1 | Anon | Só `approved`; sem pending, pareceres, view de moderação nem RPC |
| 2 | Candidato | Sem pending/pareceres/RPC/prioridade; não altera `status` |
| 3 | Curador | Um parecer por rodada; duplicata recusada |
| 4 | Admin autor + curador | Admin não autoavalia; curador avalia; duplicata recusada |
| 5 | Dois curadores | 2× approve → `approved`; 2× reject → `rejected` |
| 6 | Dois curadores | 1×1 → `pending` + linha em `jobs_needing_moderation` |
| 7 | Curadores + moderador | Terceiro curador bloqueado (`moderation required`); moderador resolve |
| 8 | Admin | `resubmit_job_for_curation` incrementa rodada; histórico permanece |
| 9 | Admin / não-admin | `urgent` exige motivo; curador não define prioridade |

`pnpm test:rls` **falha** se os cenários 3–9 forem ignorados (migration/conta ausente).

## Aplicar schema (CLI)

```powershell
npx supabase migration list --linked
npx supabase db push --linked --include-all --yes
```

`--include-all` cobre o caso em que o remoto já tem versões de histórico sem arquivo local equivalente. Neste projeto de teste: `20260816192301` e `20260816192306` (enums já aplicados). No-ops locais com esses timestamps desbloquearam o push; **não** vão para o Git. Ordem efetiva: **0004** depois **0005**.
