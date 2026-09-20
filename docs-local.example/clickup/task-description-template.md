# ClickUp — contrato fixo de task (campos + descrição)

**Governança:** não alterar sem decisão Plan. **Custom fields** = preenchidos só via `pnpm clickup:sync` (JSON local). **Descrição** = gerada automaticamente a partir de `sections` — **sem tabelas markdown**.

---

## 1. Custom fields (sync automático)

Preencher em `docs-local/clickup/sprint-handoff.config.json` → `"fields"` (e `openedAt` / `closedAt`). O script aplica na API.

| Campo | JSON |
|---|---|
| História ID | `fields["História ID"]` ou `storyId` |
| Prioridade | `fields.Prioridade` ou `priority` |
| PR | `fields.PR` — atualizar ao abrir PR |
| Veredito Plan | `fields["Veredito Plan"]` — ao revisar Plan |
| Aberta em / Fechada em | `openedAt` / `closedAt` (ISO) |

**Task ID** (`86a…`): `"clickupId"` no JSON (não é custom field). PR GitHub: `ClickUp: <clickupId>`.

---

## 2. Descrição — objeto `sections` (não colar markdown manual)

No handoff, use **`sections`**; o repo gera o markdown (`scripts/clickup-task-description.mjs`):

```json
{
  "clickupId": "86abcdefgh",
  "storyId": "SEC-EXAMPLE-01",
  "name": "SEC-EXAMPLE-01 — título curto",
  "list": "Sprint NN",
  "status": "Ready",
  "openedAt": "2026-09-20",
  "deliveryStatus": "planejamento",
  "fields": {
    "História ID": "SEC-EXAMPLE-01",
    "PR": "—",
    "Veredito Plan": "—",
    "Prioridade": "P1"
  },
  "tags": ["Segurança", "Banco de dados", "Arquitetura"],
  "sections": {
    "problem": "Texto livre…",
    "objective": "Uma frase…",
    "scope": ["item 1", "item 2"],
    "outOfScope": ["fora 1"],
    "dod": ["critério 1", "pnpm test verde"],
    "dependencies": ["Nenhum."],
    "references": ["docs-local/…"],
    "governance": "Opcional."
  }
}
```

Ao **Done**, atualize no JSON: `deliveryStatus`, `fields.PR`, `fields["Veredito Plan"]`, `closedAt`, e objeto opcional `delivery`:

```json
"deliveryStatus": "concluído",
"delivery": {
  "pr": "#159",
  "sha": "abc1234",
  "evidence": "docs-local/sec-…-review.md",
  "resolved": "Bullets para PO…",
  "changed": "Migrations, funções…"
}
```

Depois: `pnpm clickup:sync`.

---

## 3. Ciclo de vida

| Fase | Ação |
|---|---|
| Criar / Ready | Entrada no `sprint-handoff.config.json` + `pnpm clickup:sync` |
| In review | `fields.PR` = `#nnn` + sync |
| Done | `closedAt`, Veredito, `delivery` + sync |

---

## 4. Proibido

- Preencher Fields manualmente na UI (exceto emergência — corrigir JSON e sync).
- Tabelas na descrição ClickUp.
- Task nova só no chat/MCP sem entrada no JSON + sync.
