# Agentes GDGJobs — papéis e quando usar

Governança completa: [`docs/contributing.md`](docs/contributing.md). ONE-LINERs são publicados pelo **Plan Tech Lead**; execução segue **`Função / Agente`** do bloco.

## Mapa de agentes (frontend)

| Agente | Rule Cursor | Função | Quando acionar |
|---|---|---|---|
| **Executor frontend** | [`.cursor/rules/executor-frontend.mdc`](.cursor/rules/executor-frontend.mdc) | Implementar UI, integrar API, Vitest/smoke, DS-06/DS-07 | ONE-LINER de feature, fix, perf com escopo em `src/` |
| **Frontend Visual QA** | [`.cursor/rules/frontend-visual-qa.mdc`](.cursor/rules/frontend-visual-qa.mdc) | Auditoria visual/funcional no browser real; light/dark; evidências | ONE-LINER pós-implementação, QA-SEC-01a, DS-05, homolog P0 manual |
| **Plan Tech Lead** | — | ONE-LINER, revisão, backlog | Diagnóstico, parecer merge, anti-dívida de ressalvas |
| **Humano (PO/QA)** | — | Aceite de negócio, credenciais, merge final | C-05, OAuth real, checklist P0 que exige julgamento humano |

## Princípio: dois agentes, um fluxo

```
Plan ONE-LINER → Executor frontend (código + testes automatizados)
                      ↓
              Frontend Visual QA (browser + screenshots + assessment)
                      ↓
              Plan revisão → Sim merge
```

**Não misturar:** o Executor frontend **não** declara layout “ok” só lendo TSX/CSS. O Visual QA **não** implementa feature nova (só corrige se ONE-LINER pedir fix mínimo pós-auditoria).

## Ambiente local padrão

| Parâmetro | Valor |
|---|---|
| URL | `http://127.0.0.1:5173` (`pnpm dev`) |
| Tema | `html[data-theme="light"|"dark"|"system"]` — toggle no Header |
| Credenciais | `docs-local/*-test-user.md` (gitignored) |
| Matriz QA | [`docs/qa-test-plan-homolog.md`](docs/qa-test-plan-homolog.md) |
| Saída findings | [`docs/qa-security-assessment.md`](docs/qa-security-assessment.md) |

## Referências visuais obrigatórias

- **DS-06:** [`docs/design-system-communication.md`](docs/design-system-communication.md)
- **DS-07:** [`docs/design-system/section-curves.md`](docs/design-system/section-curves.md)
