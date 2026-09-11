# ClickUp — squad solo+IA

Painel **humano** para sprints, PRs e bloqueios. Execução continua no **Cursor** (ONE-LINER); prova técnica no **GitHub**.

**Configs operacionais (sprints, tasks, handoff) ficam em `docs-local/clickup/`** — gitignored, não vão para o GitHub. Esta pasta `docs-local.example/clickup/` traz só **modelos** e o guia de setup.

| Arquivo (exemplo versionado) | Uso |
|---|---|
| [`setup.md`](setup.md) | Checklist + `pnpm clickup:sync` |
| [`bootstrap.config.example.json`](bootstrap.config.example.json) | Copiar → `docs-local/clickup/bootstrap.config.json` |
| [`sprint-handoff.config.example.json`](sprint-handoff.config.example.json) | Copiar → `docs-local/clickup/sprint-handoff.config.json` |
| [`../clickup.env.example`](../clickup.env.example) | Copiar → `docs-local/clickup.env` |
| [`sprint-note-template.md`](sprint-note-template.md) | Template genérico de Sprint Note |

## Primeira vez

```powershell
New-Item -ItemType Directory -Force docs-local/clickup
Copy-Item docs-local.example/clickup.env.example docs-local/clickup.env
Copy-Item docs-local.example/clickup/bootstrap.config.example.json docs-local/clickup/bootstrap.config.json
Copy-Item docs-local.example/clickup/sprint-handoff.config.example.json docs-local/clickup/sprint-handoff.config.json
# editar os .json com sprints/tasks do seu squad
pnpm clickup:sync
```

## Fluxo rápido

0. **Sync ClickUp:** `pnpm clickup:sync` (lê `docs-local/clickup/*.config.json`)
1. PO prioriza task no ClickUp → **Ready**
2. Plan publica ONE-LINER no Cursor → Executor implementa → PR
3. PR body inclui `ClickUp: CU-xxx` (ver [`.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md))
4. Após merge → task **Done** + comentário humano de 2 linhas
5. Sexta → Sprint Note (template)

Backlog técnico longo permanece em `docs-local/` (local). ClickUp espelha **ID + status + resumo**.
