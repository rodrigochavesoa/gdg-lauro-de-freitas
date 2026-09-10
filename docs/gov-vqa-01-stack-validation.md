# GOV-VQA-01 — Validação da stack Visual QA (Playwriter CLI + scripts)

**Data:** 2026-09-09 · **Agente:** Frontend Visual QA · **Branch:** `chore/gov-vqa-01-stack-validation`  
**URL:** `http://127.0.0.1:5173` (`pnpm dev` já ativo)  
**Sem JWT/senha neste doc.**

## Ferramentas usadas

| Ferramenta | Papel nesta sessão |
|---|---|
| `pnpm dev` | App em `127.0.0.1:5173` (HTTP 200) |
| Playwright **library** (terminal) | `pwsh -File docs/assets/ds-05-eventos-newsletter/run-audit.ps1` |
| **Playwriter CLI** 0.5.0 | `playwriter session new` (extensão **verde**) · `-s 1 -f docs/assets/gov-vqa-01/_sample.mjs` |

## Ferramentas **não** usadas

| Ferramenta | Motivo |
|---|---|
| Playwright MCP (`@playwright/mcp`) | Proibido — política de tokens |
| Playwriter MCP no chat | Preferir CLI |
| chrome-devtools-mcp | Fora de escopo (nem “para comparar”) |
| Qualquer browser MCP no loop do LLM | **Zero chamadas browser MCP nesta sessão** |

## Checklist GOV-VQA-01

| # | Critério | Resultado | Evidência |
|---|---|---|---|
| G1 | Script terminal DS-05 Pass | **Pass** | [`docs/assets/ds-05-eventos-newsletter/audit-log.json`](assets/ds-05-eventos-newsletter/audit-log.json) — 13/13 `"pass": true` · runner stdout `"pass": true` |
| G2 | Playwriter CLI — `/eventos` light + dark | **Pass** | [`docs/assets/gov-vqa-01/eventos-light.png`](assets/gov-vqa-01/eventos-light.png) · [`eventos-dark.png`](assets/gov-vqa-01/eventos-dark.png) |
| G3 | Playwriter CLI — `/newsletter` light ou dark | **Pass** | [`newsletter-light.png`](assets/gov-vqa-01/newsletter-light.png) · [`newsletter-dark.png`](assets/gov-vqa-01/newsletter-dark.png) |
| G4 | Agente **não** invocou chrome-devtools-mcp / Playwright MCP | **Pass** | Declaração nesta seção + ausência de `CallDynamicTool` browser MCP no log da sessão |
| G5 | Relatório chat = tabela + paths (política tokens) | **Pass** | Mensagem final do agente (sem snapshots MCP / screenshots inline) |

## Achados P0 / P1

Nenhum.

(Aceite PO / julgamento estético DS-05 **fora de escopo** desta história.)

## Notas

- Amostragem Playwriter: ThemeToggle **Claro** + **Escuro** em `/eventos` e `/newsletter`; PNGs gravados em disco via `page.screenshot({ path })` — **não** `screenshotWithAccessibilityLabels` (evita dump de imagem no chat).
- Sem alteração em `src/`.
- OAuth Google real não executado (cenários anônimo/staff só no `_audit.mjs`).
