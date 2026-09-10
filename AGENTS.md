# Agentes GDGJobs — papéis e quando usar

Governança completa: [`docs/contributing.md`](docs/contributing.md). ONE-LINERs são publicados pelo **Plan Tech Lead**; execução segue **`Função / Agente`** do bloco.

**Setup Visual QA:** [`docs/setup-visual-qa-tools.md`](docs/setup-visual-qa-tools.md) — **Playwriter** (padrão) + scripts Playwright; evitar browser MCP no chat.

## Política de tokens — Visual QA

Browser MCP no loop do LLM (**Playwright MCP**, **Chrome DevTools MCP** passo a passo) é **ineficiente** — envia snapshots/screenshots repetidos ao contexto. GDGJobs:

- **Sempre** homolog visual via **Playwriter CLI** + evidências em `docs/assets/`
- **DS-05 / regressão repetível:** scripts terminal ([`_audit.mjs`](docs/assets/ds-05-eventos-newsletter/_audit.mjs), `pnpm qa:*`)
- **Não** auditar rotas completas via MCP no chat
- **Proibido:** Playwright MCP (`@playwright/mcp`)

Detalhes: [`docs/setup-visual-qa-tools.md`](docs/setup-visual-qa-tools.md) § *Política de tokens*.

## Plugins Cursor (resumo)

| Recurso | Visual QA | Papel |
|---|---|---|
| **Playwriter** CLI | ✅ **padrão** | OAuth, admin, light/dark — fora do chat |
| **Playwright library** | ✅ scripts | DS-05 `_audit.mjs`, `pnpm qa:admin-nav` |
| **chrome-devtools-mcp** | ⚠️ só debug pontual | **Não** auditoria completa no chat |
| **Supabase MCP** | — | DB, migrations, Edge Functions |
| **Vercel MCP** | — | Deploy preview (futuro) |
| **Playwright MCP** | ❌ proibido | — |

## Mapa de agentes (frontend)

| Agente | Rule Cursor | Função | Quando acionar |
|---|---|---|---|
| **Executor frontend** | [`.cursor/rules/executor-frontend.mdc`](.cursor/rules/executor-frontend.mdc) | Implementar UI, integrar API, Vitest/smoke, DS-06/DS-07 | ONE-LINER de feature, fix, perf com escopo em `src/` |
| **Frontend Visual QA** | [`.cursor/rules/frontend-visual-qa.mdc`](.cursor/rules/frontend-visual-qa.mdc) | Auditoria browser via **Playwriter** + scripts; light/dark; evidências em arquivo | ONE-LINER pós-implementação, QA-SEC-01a, DS-05, homolog P0 |
| **Plan Tech Lead** | — | ONE-LINER, revisão, backlog | Diagnóstico, parecer merge, anti-dívida de ressalvas |
| **Humano (PO/QA)** | — | Aceite de negócio, credenciais, merge final | C-05, OAuth real, aceite DS-05 |

## Stack Frontend Visual QA (adotada)

| Prioridade | Ferramenta | Papel |
|---|---|---|
| 1 | **Playwriter** | Homolog interativo — Chrome do usuário, OAuth, admin, screenshots em disco |
| 2 | **Playwright (terminal)** | DS-05 `_audit.mjs`, `pnpm qa:admin-nav` — agente lê JSON/resumo |
| 3 | **Humano** | Aceite PO / DS-05 |
| 4 | **chrome-devtools-mcp** | Só debug pontual (1 URL) — **não** substitui Playwriter |

**Não adotado:** [dev-browser](https://github.com/SawyerHood/dev-browser) (Windows não suportado). **Proibido:** Playwright MCP.

## Princípio: dois agentes, um fluxo

```
Plan ONE-LINER → Executor frontend (código + testes automatizados)
                      ↓
              Frontend Visual QA (Playwriter + scripts / evidências em docs/assets)
                      ↓
              Plan revisão → Sim merge
```

**Não misturar:** o Executor frontend **não** declara layout “ok” só lendo TSX/CSS. O Visual QA **não** implementa feature nova (só corrige se ONE-LINER pedir fix mínimo pós-auditoria). O Visual QA **não** usa browser MCP para auditoria completa no chat.

## Ambiente local padrão

| Parâmetro | Valor |
|---|---|
| URL | `http://127.0.0.1:5173` (`pnpm dev`) |
| Tema | `html[data-theme="light"|"dark"|"system"]` — toggle no Header |
| Credenciais | `docs-local/*-test-user.md` (gitignored) |
| Matriz QA | [`docs/qa-test-plan-homolog.md`](docs/qa-test-plan-homolog.md) |
| Saída findings | [`docs/qa-security-assessment.md`](docs/qa-security-assessment.md) |
| Evidências visuais | `docs/assets/<id>/` (PNG, `audit-log.json`) |

## Referências visuais obrigatórias

- **DS-06:** [`docs/design-system-communication.md`](docs/design-system-communication.md)
- **DS-07:** [`docs/design-system/section-curves.md`](docs/design-system/section-curves.md)
