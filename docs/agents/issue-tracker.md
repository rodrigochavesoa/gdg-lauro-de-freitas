# Issue tracker — GDGJobs

**Canonical tracker (squad):** [ClickUp](https://app.clickup.com/) — tarefas da sprint, ONE-LINERs e handoff.

**Secondary (comunidade / lab):** GitHub Issues em [`rodrigochavesoa/gdg-lauro-de-freitas`](https://github.com/rodrigochavesoa/gdg-lauro-de-freitas).

Operação ClickUp (tokens, IDs, sprint note) fica em **`docs-local/`** (gitignored). Este arquivo só descreve **como agentes resolvem spec** sem expor dados do squad.

## PRs as a request surface

`false` — PRs no GitHub são revisão de código; intake de sprint não entra pela fila de issues do GitHub.

## Resolving work from a branch or PR

Ordem sugerida para o eixo **Spec** (`code-review`, `to-spec`, etc.):

1. **Corpo da PR** — linha `ClickUp: <id>` (ID da URL da task, ex. `17thgbzu83n`). História interna (`SEC-*`, `UX-*`, `TECH-*`) pode aparecer no título da task, não substitui o ID no PR.
2. **Commits** — `ClickUp: <id>` ou referência `#<n>` a issue GitHub.
3. **Handoff local** — `docs-local/clickup/sprint-handoff.config.json`: buscar por `clickupId`, `fields["História ID"]` ou título.
4. **ONE-LINER** — `docs-local/*-one-liner.md` quando a task está **Ready** (Problema, DoD, branch, baseline).
5. **GitHub issue** — quando não houver ClickUp nem ONE-LINER.

## Fetching issue content

### ClickUp

- **UI:** `https://app.clickup.com/t/<clickupId>`
- **Agente com MCP:** ferramentas `clickup_get_task` / `clickup_filter_tasks` (workspace já autenticado no Cursor).
- **Offline / sem MCP:** ler `sections` (Problema, DoD, Entrega) e `fields` no `sprint-handoff.config.json`; complementar com o ONE-LINER se existir.
- **Não** commitar tokens, `clickup.env` nem export completo do workspace.

### GitHub Issues

```powershell
gh issue view <number> --repo rodrigochavesoa/gdg-lauro-de-freitas --json title,body,labels,state,comments
```

Listar abertas:

```powershell
gh issue list --repo rodrigochavesoa/gdg-lauro-de-freitas --limit 30
```

### Local markdown (fallback)

Se alguém registrar spec só em disco: `docs-local/` ou `.scratch/<branch>/spec.md` — preferir ClickUp + ONE-LINER no fluxo GDGJobs.

## Creating or updating work (humans / PO)

| Ação | Onde |
|------|------|
| Nova task mid-sprint | ClickUp + entrada em `sprint-handoff.config.json` → `pnpm clickup:sync` |
| Liberar Executor | ONE-LINER em `docs-local/` + comentário na task |
| Bug / ideia pública | GitHub Issue no repo do lab |
| Fechar entrega | PR merged → atualizar handoff (`fields.PR`, `closedAt`) + sync |

Contrato de descrição e metadados: `docs-local.example/clickup/task-description-template.md`, `task-metadata.md`. Fluxo completo: `CONTRIBUTING.md` § *ClickUp* e *Trabalho não programado*.

## Wayfinding operations

- **“O que está Ready?”** — filtrar handoff por status Ready / ONE-LINER existente; Sprint Note em `docs-local/clickup/` (se existir).
- **“Qual o baseline?”** — ONE-LINER ou último squash em `main` citado no handoff / comentário Plan.
- **“Onde está a spec desta branch?”** — PR body `ClickUp:` → task → sections + ONE-LINER; senão `gh issue view`.
