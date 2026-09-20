# ClickUp — contrato fixo de task (campos + descrição)

**Governança:** este é o **único** formato aprovado para tasks de entrega no squad. Plan, Executor e agentes **não** inventam novas seções nem movem aceite só para comentários soltos. Custom fields = painel e filtros; descrição = narrativa + DoD + **entrega ao concluir**.

Referência: `CONTRIBUTING.md` · `task-metadata.md` · `setup.md` § Custom fields.

---

## 1. Custom fields (obrigatório — preencher na UI ou via `pnpm clickup:sync`)

| Campo ClickUp | Quando | Exemplo |
|---|---|---|
| **História ID** | Ao criar a task | `SEC-DB-FUNCTION-HARDENING-01` |
| **Prioridade** | Ao criar | `P1` |
| **Aberta em** | Ao abrir trabalho (`openedAt` no JSON) | data real |
| **Fechada em** | Só quando status **Done** (`closedAt`) | data real |
| **PR** | Quando abrir PR | `#159` |
| **Veredito Plan** | Após revisão Plan | `APROVADO` · `APROVADO COM RESSALVAS` · `REPROVADO` · `—` |

**Task ID ClickUp** (`86a…` na URL) **não** vai em custom field — use na linha do PR: `ClickUp: 86a…`.

Sync: `docs-local/clickup/sprint-handoff.config.json` → `"fields": { "História ID": "…", "PR": "—", … }` + `pnpm clickup:sync`.

---

## 2. Descrição — seções fixas (copiar ao criar task)

Manter **esta ordem** e **estes títulos** (`##`). Não remover seções; se vazio, escrever `—` ou `_A preencher ao concluir._`

```markdown
## Problema / contexto

Por que esta task existe agora (1–3 parágrafos ou bullets). Link para decisão em `docs-local/` se houver.

## Objetivo

Uma frase mensurável do resultado.

## Escopo

- Item incluído 1
- Item incluído 2

## Fora do escopo

- Item excluído 1

## Definição de pronto (DoD / aceite)

Checklist observável (comandos, migrations, evidências):

- [ ] …
- [ ] `pnpm lint`, `pnpm test`, `pnpm build`
- [ ] …

## Dependências e bloqueios

- Humano: …
- Técnica: …
- Se nenhum: `Nenhum.`

## Referências

- `docs-local/…`
- ONE-LINER: `docs-local/mvp-sprint-plan-and-handoffs.md` § `CÓDIGO-HISTÓRIA`
- Branch sugerida: `feat/…` ou `chore/…`

## Entrega (preencher ao concluir)

**Status entrega:** `planejamento` | `em andamento` | `concluído`

| Item | Valor |
|---|---|
| PR | _(campo **PR** deve espelhar `#nnn`)_ |
| SHA merge em `main` | |
| Preview / evidência | link ou path `docs-local/assets/…` |

### O que foi resolvido

_(Bullets para PO/stakeholder: comportamento, risco, UX — preencher no **Done**.)_

### O que foi alterado (resumo técnico)

_(Arquivos, migrations, RPCs, flags — preencher no **Done**; pode colar resumo do PR.)_
```

---

## 3. Ciclo de vida da descrição

| Fase | Quem | Campos | Descrição |
|---|---|---|---|
| **Criação / Ready** | Plan | História ID, Prioridade, Aberta em, PR=`—`, Veredito=`—` | Seções até **Referências** completas; **Entrega** com status `planejamento` e subseções “_A preencher_” |
| **In progress** | Executor | — | Status entrega → `em andamento`; opcional comentário na task |
| **In review** | Executor | **PR** = `#nnn` | Corpo do PR: `ClickUp: <task-id>` |
| **Done** | Executor + Plan | **Fechada em**, **Veredito Plan** | Preencher **O que foi resolvido** e **O que foi alterado**; status entrega → `concluído` |

---

## 4. Sprint Note

Sprint Note usa corpo livre **mas** deve listar fluxo numerado e linkar **História ID** das tasks. Não substitui o contrato acima nas tasks filhas.

---

## 5. O que agentes não devem fazer

- Trocar DoD por só tags ou só título da task.
- Apagar **Entrega** ao fechar — **preencher**.
- Duplicar **História ID** só na descrição sem custom field (descrição pode citar o código, mas o **campo** é obrigatório).
- Criar task só via MCP sem `fields` / sem sync quando o squad usa `sprint-handoff.config.json`.

---

## 6. Exemplo mínimo (planejamento)

Ver task modelo no handoff após sync; cópia local do squad pode fixar exemplos reais em `docs-local/clickup/task-examples.md` (gitignored).
