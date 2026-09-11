# ClickUp — configuração (solo+IA)

Checklist para squad **solo+IA**. Marque cada item ao concluir no ClickUp. **Sprints, tasks e handoff** ficam em `docs-local/clickup/` (não vão para o Git). Esta pasta `docs-local.example/clickup/` traz só guia e modelos `.example.json`.

Repositório GitHub: `rodrigochavesoa/gdg-lauro-de-freitas`

---

## Bootstrap automatizado

Provisiona (ou completa) Space, Folders, Lists, custom fields e tasks via **ClickUp API**. O script é **idempotente**: a 2ª execução não duplica Space nem tasks (log `skipped`).

**Configs operacionais** (`bootstrap.config.json`, `sprint-handoff.config.json`) ficam em **`docs-local/clickup/`** (gitignored). Quem clona o repo copia os modelos `.example.json` desta pasta e preenche com o squad.

### Primeira vez

```powershell
New-Item -ItemType Directory -Force docs-local/clickup
Copy-Item docs-local.example/clickup.env.example docs-local/clickup.env
Copy-Item docs-local.example/clickup/bootstrap.config.example.json docs-local/clickup/bootstrap.config.json
Copy-Item docs-local.example/clickup/sprint-handoff.config.example.json docs-local/clickup/sprint-handoff.config.json
# preencher clickup.env + editar os .json com sprints/tasks do squad
pnpm clickup:sync
```

### Sync completo

Com `docs-local/clickup/` preenchido (bootstrap + handoff do squad):

```powershell
pnpm clickup:sync
```

Comandos separados:

| Comando | O que faz |
|---|---|
| `pnpm clickup:bootstrap` | Space + tasks do `bootstrap.config.json` local |
| `pnpm clickup:sprint-handoff` | Sprint Note + handoff do `sprint-handoff.config.json` local |
| `pnpm clickup:sync` | Os dois em sequência |

Credenciais **somente local**. `docs-local/` está no `.gitignore` — **nunca** commitar token nem configs de sprint.

Token: ClickUp → **Settings → Apps → API**. Team ID: número na URL do workspace (`https://app.clickup.com/{id}/home`).

O script **não** liga GitHub. **Integração GitHub continua manual** (1 clique OAuth) — §3 abaixo é obrigatório após o bootstrap. Plugin Cursor (§4) continua opcional.

A API pública **não cria** os statuses customizados da List (só `to do` / `complete`). O bootstrap mapeia **Done → complete** e **Blocked → to do**. Depois, no ClickUp: List → ⋯ → Statuses, ajuste o workflow do §1 (Backlog → Ready → In progress → In review → Done + Blocked).

Automação ClickUp “PR merged → Done” também é **manual** (checklist no §3); o bootstrap não cria Automations.

Checklist **manual obrigatório** depois do script:

- [ ] §3 Integração GitHub (OAuth)
- [ ] §4 Plugin ClickUp no Cursor (opcional P2) — ou marcado **Pulado**

Se preferir criar tudo na UI (sem token), use o checklist §1–§2 abaixo.

---

## 1. Space e pastas (Folder / List)

- [ ] **Workspace:** seu workspace ClickUp
- [ ] **Space:** nome do produto (ex.: `Meu Produto MVP`)
- [ ] **Folder:** `Product Backlog` — ideias P2/P3, polish
- [ ] **Folder:** `Sprints` — uma **List** por sprint
- [ ] **List:** `Sprint 01` (sprint atual ou encerrada)
- [ ] **List:** `Sprint 02` (próxima sprint)
- [ ] **Folder:** `Ops / Bloqueios` — credenciais, aceite PO, dependências humanas

### Status (workflow da List)

Configure estes status na List (Settings → List → Statuses):

| Status | Cor sugerida | Significado |
|---|---|---|
| Backlog | cinza | Ideia registrada |
| Ready | azul | ONE-LINER publicado; pode executar |
| In progress | amarelo | Agente / dev implementando |
| In review | roxo | PR aberto ou Plan revisando |
| Done | verde | Merge em `main` + aceite |
| Blocked | vermelho | Depende humano (credencial, PO) |

Ordem sugerida: Backlog → Ready → In progress → In review → Done (+ Blocked paralelo).

---

## 2. Custom fields (Space ou Workspace)

Em **Space settings → Custom Fields**, crie:

| Nome | Tipo | Exemplo |
|---|---|---|
| **História ID** | Texto curto | `EXEMPLO-01` |
| **PR** | Texto curto | `#42` |
| **Veredito Plan** | Dropdown | `APROVADO` · `APROVADO COM RESSALVAS` · `REPROVADO` · `—` |
| **Prioridade** | Dropdown | `P0` · `P1` · `P2` · `P3` |

- [ ] Quatro campos criados e visíveis nas Lists de Sprints e Backlog

---

## 3. Integração GitHub

1. ClickUp → **Settings** (workspace) → **Integrations** → **GitHub**
2. Authorize GitHub → selecionar org/user `rodrigochavesoa`
3. Conectar repositório **`gdg-lauro-de-freitas`**
4. Habilitar sync de **Pull requests** e **Commits** (conforme plano ClickUp)

Checklist:

- [ ] Integração GitHub ativa
- [ ] Repo `gdg-lauro-de-freitas` linkado
- [ ] Teste: abrir PR com linha `ClickUp: CU-xxxxx` no corpo → atividade aparece na task

### Vincular PR à task

No corpo do PR (template do repo):

```md
ClickUp: CU-xxxxx
```

Substitua `CU-xxxxx` pelo ID real da task (copie da URL da task no ClickUp).

Opcional — automação ClickUp (Automations):

- [ ] Trigger: **GitHub PR merged** → Action: **Set status to Done** (filtrar por tag ou custom field PR preenchido)

---

## 4. Plugin ClickUp no Cursor (opcional P2)

Não obrigatório para solo+IA.

1. Cursor → Extensions → buscar **ClickUp**
2. Conectar ao mesmo workspace
3. Use só para criar/atualizar task sem sair do IDE

- [ ] Instalado (opcional) · ou **Pulado**

---

## 5. Ritmo semanal (solo)

| Quando | Ação | Onde |
|---|---|---|
| Segunda | 1–2 tasks → **Ready** | ClickUp |
| Diário | ONE-LINER → PR | Cursor + GitHub |
| Pós-merge | Comentário humano + **Done** | ClickUp task |
| Sexta | Sprint Note (5 bullets) | List ou Doc — [`sprint-note-template.md`](sprint-note-template.md) |

Standup async (comentário na task ativa):

```text
Ontem: PR #N mergeado — [uma linha usuário]
Hoje: [próximo P0 ou bloqueio]
Bloqueio: [nenhum | credencial externa | aceite PO | …]
```

---

## 6. Próximo passo

1. Rodar **`pnpm clickup:sync`** (topo deste arquivo) após preencher `docs-local/clickup/`.
2. **Humano:** concluir §3 — integração GitHub (OAuth). Sem isso, `ClickUp: CU-xxx` no PR não aparece na task.
3. **Gates entre sprints:** quando uma task **Blocked** virar **Done**, avisar o Plan → ONE-LINER → task **Ready** → Cursor executa.
