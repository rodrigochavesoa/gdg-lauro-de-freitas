# Evidência S1-04 — proteção de `main`

**Data:** 2026-08-16  
**Repositório:** [rodrigochavesoa/gdg-lauro-de-freitas](https://github.com/rodrigochavesoa/gdg-lauro-de-freitas)  
**Ator:** mantenedor (`ADMIN`), via GitHub API (`gh`), sem push direto em `main`.

## O que foi habilitado

Ruleset **Protect main** (id `20903173`), enforcement `active`, alvo `refs/heads/main`.

| Regra | Efeito |
|---|---|
| `pull_request` | Merge em `main` só via Pull Request |
| `required_status_checks` | Check obrigatório **Lint, test and build** (workflow `CI`); branch precisa estar atualizada (`strict`) |
| `deletion` | `main` não pode ser apagada |
| `non_fast_forward` | Sem force-push em `main` |
| Bypass | Nenhum (`bypass_actors` vazio; `current_user_can_bypass: never`) |

Configuração do repositório (além do ruleset): squash merge habilitado; merge commit e rebase desabilitados; apagar branch após merge.

## Como conferir

- UI: https://github.com/rodrigochavesoa/gdg-lauro-de-freitas/rules/20903173
- Settings → Rules → Rulesets → **Protect main**
- API: `GET /repos/rodrigochavesoa/gdg-lauro-de-freitas/rulesets/20903173`

Payload aplicado (espelho): [`.github/branch-protection-main.ruleset.json`](../.github/branch-protection-main.ruleset.json).

## Observação

Zero aprovações obrigatórias para não bloquear o único mantenedor; o PR continua obrigatório e o CI precisa ficar verde. Revisão humana permanece na Definition of Done (`docs/contributing.md`).
