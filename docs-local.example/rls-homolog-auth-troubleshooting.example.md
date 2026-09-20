# RLS homolog — Auth rate limit vs TOTP (modelo)

Copie para `docs-local/rls-homolog-auth-troubleshooting.md` e ajuste datas/incidentes do squad.

## Contexto

- Job **RLS homolog** (`pnpm test:rls`) só roda em `push` / `workflow_dispatch` na `main`, com secrets do GitHub Environment **`homolog-rls`**.
- O harness faz **dezenas** de `signInWithPassword` + MFA por execução. O Supabase Auth pode responder **`Request rate limit reached`** / **`over_request_rate_limit`**.
- Isso **não** é o mesmo que TOTP errado.

## Sintomas no log

| Mensagem (trecho) | Provável causa | Ação |
|---|---|---|
| `Request rate limit` / `over_request_rate_limit` no **login** (senha) ou no **challenge** | Rajada de auth no projeto de homolog | Pausar `test:rls` local e re-runs CI; esperar 30–60 min; o harness em `main` já inclui backoff/retry (PR #157). |
| `Invalid TOTP` / falha só no **verify** (senha OK) | Secret base32 não bate com o fator verificado | Re-enroll ou atualizar `*_TEST_TOTP_SECRET` no `.env.local` **e** em `homolog-rls`. |
| `conta staff sem fator TOTP verificado` | Enroll pendente na conta de teste | Enroll TOTP na UI `/admin` ou Dashboard Auth. |
| Cenários 21–22 falham no admin após cenário 20 | Pico de MFA no final do job | Mesmo que rate limit; evitar `workflow_dispatch` em sequência. |

## Onde ficam os secrets TOTP

| Ambiente | Fonte |
|---|---|
| Local (`pnpm test:rls`) | `ADMIN_TEST_TOTP_SECRET` etc. no **`.env.local`** têm **prioridade** sobre `docs-local/staff-mfa-totp-secrets.md`. |
| GitHub Actions | **Somente** secrets do Environment `homolog-rls` — não há `.env.local` nem `staff-mfa-totp-secrets.md` no runner. |

**Importante:** após o enroll, o Dashboard **não** reexibe a chave base32. Guarde a chave da tela de enroll (ou export do autenticador) nos dois lugares acima. Nunca use prefixo `VITE_` nos secrets TOTP do harness.

## Diagnóstico (sem vazar secret)

```powershell
pnpm verify:staff-mfa
```

- Imprime **fingerprint** (12 hex do SHA-256 do secret sem espaços) por papel — compare o `fp` do admin local com o valor que você colou no GitHub (calcule o mesmo hash offline).
- Faz um probe `signIn` + `mfa.verify` só para admin.

## Boas práticas

1. Não alternar `pnpm test:rls` local e **RLS homolog** no CI no mesmo intervalo curto.
2. Não disparar vários `workflow_dispatch` seguidos “para testar”.
3. PR verde ≠ RLS verde: merge primeiro; RLS roda depois.
4. Falha de RLS em `main`: tratar release como não confiável — ver `SETUP.md` e `docs-local/sec-ci-secrets-01-rollback.md`.

## Incidentes (preencher localmente)

| Data | Sintoma | Resolução |
|---|---|---|
| _exemplo_ | rate limit cen. 8–22 | merge harness backoff; cooldown 1h |
