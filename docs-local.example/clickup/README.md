# ClickUp — squad solo+IA (GDGJobs)

Painel **humano** para sprints, PRs e bloqueios. Execução continua no **Cursor** (ONE-LINER); prova técnica no **GitHub**.

| Arquivo | Uso |
|---|---|
| [`setup.md`](setup.md) | Bootstrap `pnpm clickup:bootstrap` + checklist manual (GitHub OAuth obrigatório) |
| [`bootstrap.config.json`](bootstrap.config.json) | Space, Folders, Lists, statuses, custom fields e tasks Sprint 09 |
| [`../clickup.env.example`](../clickup.env.example) | Modelo de `docs-local/clickup.env` (nunca commitar o arquivo real) |
| [`sprint-note-template.md`](sprint-note-template.md) | Copiar no fim de cada sprint (ClickUp Doc ou comentário na List) |
| [`sprint-09-done.md`](sprint-09-done.md) | Tasks **Done** + Sprint Note (#80–#83) — espelhadas no bootstrap |

## Fluxo rápido

1. PO prioriza task no ClickUp → **Ready**
2. Plan publica ONE-LINER no Cursor → Executor implementa → PR
3. PR body inclui `ClickUp: CU-xxx` (ver [`.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md))
4. Após merge → task **Done** + comentário humano de 2 linhas
5. Sexta → Sprint Note (template)

Backlog técnico longo permanece em `docs-local/project-backlog-scrum.md` (local). ClickUp espelha **ID + status + resumo**.
