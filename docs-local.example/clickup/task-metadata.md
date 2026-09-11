# ClickUp — metadados de task (agentes)

Contrato **obrigatório** para **`pnpm clickup:sync`**. Configs reais em **`docs-local/clickup/`** (gitignored). Modelos genéricos em `*.example.json`.

**GOV-CLICKUP-03 (implementado):** `bootstrap-clickup.mjs`, `sprint-handoff-clickup.mjs` e `clickup-task-metadata.mjs` aplicam **assignee**, **tags** (1–3) e **datas** em cada task. Reexecução idempotente — contadores `skipped.assignees`, `skipped.tags`, `skipped.dates` quando já estiver correto.

---

## Regra de ouro (todos os agentes)

| Quem | Obrigação |
|---|---|
| **Plan** | Ao definir handoff/sprint, toda task nova no JSON local **deve** incluir `tags`, `openedAt` e (`closedAt` se Done). Assignee humano via `defaults` + `clickup.env`. |
| **Executor** | Ao criar task no config ou rodar sync: **nunca** omitir metadados; validar 2ª execução (`skipped`, sem duplicar tags). |
| **Qualquer agente** | **Não** colocar nome/e-mail real, Sprint 09/10 ou IDs CU-xxx em arquivos versionados — só `docs-local/`. |

Task **sem** `tags` / datas / assignee resolvível → sync incompleto; corrigir config local antes de declarar sprint fechada.

---

## Scripts no Git vs dados locais

| Versionado (`scripts/`) | Local (`docs-local/clickup/`) |
|---|---|
| Lógica genérica de sync (API ClickUp, idempotência, retry 429) | `bootstrap.config.json`, `sprint-handoff.config.json` |
| `clickup-task-metadata.mjs` — taxonomia de tags, assignee, datas | Nome do PO, e-mail, sprints, tasks, datas reais |
| Fixtures em `scripts/fixtures/clickup/` (Sprint 01, `you@example.com`) | `clickup.env` (token + `CLICKUP_ASSIGNEE_*`) |

**Por que os scripts ficam públicos:** são **ferramentas** reutilizáveis (como `check-rls.mjs`), rodam no CI (`pnpm test` 24 testes) e não carregam dados do squad. O risco de vazamento está no **config**, não no código — por isso configs ficam gitignored. **Não** mover scripts ClickUp para `docs-local/` sem decisão PO (quebraria CI e clone limpo).

Arquivos públicos ClickUp:

| Script | Função |
|---|---|
| `scripts/bootstrap-clickup.mjs` | Space, lists, fields, tasks iniciais |
| `scripts/sprint-handoff-clickup.mjs` | Sprint Note, move, tasks da próxima sprint |
| `scripts/clickup-task-metadata.mjs` | Assignee, tags, datas (módulo compartilhado) |

---

## 1. Assignee (humano condutor)

| Campo | Onde | Regra |
|---|---|---|
| Nome exibido | `docs-local/clickup.env` → `CLICKUP_ASSIGNEE_NAME` | PO/mantenedor que conduz o processo no ClickUp |
| Resolução na API | `CLICKUP_ASSIGNEE_EMAIL` ou `CLICKUP_ASSIGNEE_USER_ID` | E-mail do membro no workspace ClickUp (preferido) ou id numérico |

Preencher nome/e-mail **somente** no `clickup.env` e nos configs de `docs-local/clickup/` (nunca no Git).

- Toda task criada/atualizada pelo sync **deve** ter esse assignee (idempotente: não duplicar).
- Tasks 100% agente ainda registram o **humano PO** como assignee (accountability).
- Override por task: `"assignee": { "email": "..." }` ou `{ "name": "..." }` no JSON (raro).

---

## 2. Datas (abertura e fechamento)

| Campo no config | Significado | Quando preencher |
|---|---|---|
| `openedAt` | Task **aberta** (início trabalho) | ISO `YYYY-MM-DD` |
| `closedAt` | Task **fechada** | ISO `YYYY-MM-DD` quando status → **Done** |

**Regras:**

- **Done**: `openedAt` ≠ `closedAt` (validar no ClickUp).
- **Blocked / Backlog / Ready**: só `openedAt`; sem `closedAt`.
- **Sprint Note** Done: intervalo da sprint; corpo ganha `**Intervalo:** YYYY-MM-DD → YYYY-MM-DD` (API `date_closed` é só leitura).
- Custom fields **Aberta em** / **Fechada em** (tipo date) — bootstrap tenta criar; script preenche quando existirem.
- API: `start_date` em ms; retry **429** no client HTTP.

---

## 3. Tags (taxonomia)

Cada task: **1–3 tags** (`tags[]`). Fora da lista → erro de validação / log. Script cria tag no Space se ausente.

| Tag | Quando usar |
|---|---|
| `Frontend` | UI React, rotas, componentes, CSS |
| `Backend` | API, Edge Functions, server, e-mail server-side |
| `Banco de dados` | Migrations, RLS, Postgres, Supabase |
| `Segurança` | RLS, auth, segredos, hardening |
| `QA` | Testes manuais, Visual QA, aceite PO visual |
| `Arquitetura` | Decisões estruturais, refactors transversais |
| `DevOps` | CI, deploy, scripts infra, GitHub Actions |
| `Governança` | Repo, processo, ClickUp, CONTRIBUTING |
| `UX` | Navegação, fluxo usuário, copy de interface |
| `Integração` | Serviços externos (e-mail, ClickUp, OAuth) |
| `Ops humano` | Credencial, domínio, aceite PO sem PR de código |

Mapeie entregas do squad **somente** em `docs-local/clickup/*.config.json`.

---

## 4. Schema JSON (por task)

```json
{
  "list": "Sprint 01",
  "name": "Exemplo — entrega",
  "status": "Done",
  "assignee": { "email": "you@example.com" },
  "tags": ["Frontend", "UX"],
  "openedAt": "2026-01-10",
  "closedAt": "2026-01-20",
  "fields": { "História ID": "EXEMPLO-01" }
}
```

**Defaults** (topo de `bootstrap.config.json` / `sprint-handoff.config.json`):

```json
"defaults": {
  "assignee": { "email": "you@example.com" },
  "tags": []
}
```

Env `CLICKUP_ASSIGNEE_*` completa o que faltar nos defaults.

---

## 5. Idempotência (2ª execução esperada)

Exemplo saudável após handoff já aplicado:

```json
{
  "created": { "assignees": 0, "tags": 0, "dates": 0 },
  "skipped": { "assignees": 4, "tags": 4, "dates": 4 }
}
```

`updated` pode refletir PUT de descrição — normal. **Não** deve recriar task movida (bootstrap busca por nome em **qualquer** list antes de criar).

---

## 6. Checklist do agente

- [ ] Nova task em `docs-local/clickup/` → `tags` + datas + assignee (via defaults).
- [ ] `*.example.json` / fixtures só placeholders genéricos.
- [ ] `pnpm test` scripts ClickUp (24/24).
- [ ] `pnpm clickup:sync` → validar no ClickUp; 2ª vez → `skipped` em metadados.
- [ ] Nenhum dado squad no diff versionado.

Referências: [`setup.md`](setup.md) · [`../clickup.env.example`](../clickup.env.example)
