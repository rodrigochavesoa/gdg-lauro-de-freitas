# Setup — Ferramentas Frontend Visual QA

**Agente:** Frontend Visual QA · **Rule:** [`.cursor/rules/frontend-visual-qa.mdc`](../.cursor/rules/frontend-visual-qa.mdc)  
**Matriz:** [`qa-test-plan-homolog.md`](qa-test-plan-homolog.md) · **Saída:** [`qa-security-assessment.md`](qa-security-assessment.md)

Este guia adota a stack acordada para eliminar o “ponto cego” visual (validação só por TSX/linter/Vitest) **sem** estourar tokens do agente no chat.

## Política de tokens (obrigatória)

Browser **MCP** no loop do LLM (Playwright MCP, Chrome DevTools MCP passo a passo) envia **snapshots e screenshots repetidos para o contexto** — classificado como **ineficiente** para auditorias completas (cf. prática recomendada na comunidade: preferir CLI + arquivos em disco).

| Abordagem | Tokens no chat | Adotado GDGJobs |
|---|---|---|
| **Playwriter CLI** + screenshots em `docs/assets/` | Baixo | **Sim — padrão Visual QA** |
| **Scripts Playwright** (`_audit.mjs`, `pnpm qa:*`) — agente lê só JSON/resumo | Baixo | **Sim — DS-05 e perf** |
| **chrome-devtools-mcp** no chat (navegar + screenshot a cada passo) | Alto | **Não** para homolog completa |
| **Playwright MCP** (`@playwright/mcp`) | Muito alto | **Proibido** |
| **Playwriter MCP** no chat | Médio/alto | **Não** — preferir CLI |

**Regra de ouro:** evidência visual vai para **arquivo** (`docs/assets/…`, `audit-log.json`); o agente consome **resumo**, não dezenas de capturas inline.

---

## Stack (ordem de uso)

| Prioridade | Ferramenta | Quando usar | Windows |
|---|---|---|---|
| **1** | [Playwriter](https://github.com/remorses/playwriter) CLI + extensão | **Sempre** homolog Visual QA: OAuth, admin, light/dark, interações no **seu Chrome** | ✅ |
| **2** | Playwright **library** (terminal) | DS-05 repetível: [`docs/assets/ds-05-eventos-newsletter/_audit.mjs`](assets/ds-05-eventos-newsletter/_audit.mjs); perf: `pnpm qa:admin-nav` | ✅ |
| **3** | Humano (PO) | Aceite DS-05, julgamento estético final | ✅ |
| **4** | [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) | **Só troubleshooting pontual** (1 erro de console/rede) — **não** auditoria de rotas | ✅ |
| — | [Playwright MCP](https://playwright.dev/docs/getting-started-mcp) | **Proibido** — snapshots ARIA no chat | ❌ |
| — | [dev-browser](https://github.com/SawyerHood/dev-browser) | **Não adotado** — Windows não suportado upstream | ❌ |

## Plugins e MCP Cursor (GDGJobs)

| Recurso | Visual QA | Backend / deploy | Tokens |
|---|---|---|---|
| **Playwriter** (CLI) | **Padrão** | — | Baixo |
| **Playwright library** | `_audit.mjs`, `pnpm qa:*` | — | Baixo |
| **chrome-devtools-mcp** | Evitar loop no chat; último recurso | Debug console/rede | **Alto se usado como auditor** |
| **Supabase MCP** | — | migrations, advisors, Edge Functions | OK (não é browser) |
| **Vercel MCP** | — | preview deploy (futuro) | OK |
| **Playwright MCP** | **Não instalar** | — | Proibido |

### Mapa por fase

| Fase | Use | Evite no chat |
|---|---|---|
| Homolog UI (DS-05, P0) | Playwriter + `_audit.mjs` | chrome-devtools-mcp passo a passo, Playwright MCP |
| OAuth / admin logado | Playwriter | MCP browser automation |
| Perf admin remount | `pnpm qa:admin-nav` | Agente “clicando” no admin via MCP |
| Backend / RLS | Supabase MCP + `pnpm test:rls` | — |
| Debug pontual (1 console error) | chrome-devtools-mcp **escopo mínimo** | “Audite o site inteiro” via MCP |

O [`.cursor/mcp.json`](../.cursor/mcp.json) mantém `chrome-devtools` com `--slim` para quem precisar de debug; **não** substitui Playwriter na governança Visual QA.

---

## Pré-requisitos comuns

```powershell
cd c:\Colab_Developer\gdg-senai
pnpm install
pnpm exec playwright install chromium   # scripts _audit.mjs e qa:*
```

App local (terminal separado):

```powershell
pnpm dev
# URL padrão: http://127.0.0.1:5173
```

Credenciais de teste (gitignored): `docs-local/admin-test-user.md`, `docs-local/candidate-test-user.md`.

---

## 1. Playwriter (padrão Visual QA)

Playwriter controla **seu Chrome** via extensão — OAuth Google, admin logado, ThemeToggle light/dark. **Fora do loop MCP do Cursor** (CLI no terminal).

### Instalação (uma vez)

1. **Extensão Chrome:** [Chrome Web Store — Playwriter](https://chromewebstore.google.com/) (ou [playwriter.dev](https://playwriter.dev)).
2. **CLI global:**
   ```powershell
   npm install -g playwriter
   ```
3. **Skill do agente (opcional):**
   ```powershell
   npx -y skills add https://playwriter.dev
   ```

### Uso rápido

1. Abra `http://127.0.0.1:5173` no Chrome.
2. Clique no ícone Playwriter na aba → fica **verde**.
3. Terminal:
   ```powershell
   playwriter session new
   playwriter -s 1 -e 'await page.goto("http://127.0.0.1:5173/eventos")'
   playwriter -s 1 -e 'await screenshotWithAccessibilityLabels({ page })'
   ```

Salvar screenshots em `docs/assets/<id-evidencia>/` — **não** colar imagens grandes no chat do agente.

### Light / Dark

Alternar pelo **ThemeToggle** no Header (Claro / Escuro); repetir screenshot por tema.

**Não usar** Playwriter MCP no chat para auditorias longas — preferir CLI acima.

---

## 2. Scripts Playwright (terminal — DS-05 e perf)

Automação **fora do MCP**: o agente roda o script e lê `audit-log.json` / exit code.

### DS-05 — `/eventos` + `/newsletter`

```powershell
pnpm dev   # terminal 1 — http://127.0.0.1:5173
pwsh -File docs/assets/ds-05-eventos-newsletter/run-audit.ps1
# ou: node docs/assets/ds-05-eventos-newsletter/_audit.mjs
```

Saída: PNGs + [`audit-log.json`](assets/ds-05-eventos-newsletter/audit-log.json). Ver [`README`](assets/ds-05-eventos-newsletter/README.md).

### Perf admin

```powershell
pnpm qa:admin-nav
```

Script: [`scripts/measure-admin-nav.mjs`](../scripts/measure-admin-nav.mjs).

**Não entra no CI** por padrão (requer `docs-local/` + dev server).

---

## 3. chrome-devtools-mcp (opcional — só debug)

Presente em [`.cursor/mcp.json`](../.cursor/mcp.json) com `--slim --headless`.

**Não usar** para:
- Auditoria DS-05 completa
- Percorrer múltiplas rotas light/dark no chat
- Substituir Playwriter ou `_audit.mjs`

**Usar só** para investigação pontual (ex.: um 404 na rede, um erro de console) — **uma** URL, **uma** captura, encerrar.

Se MCP offline: use Playwriter + `_audit.mjs` (fallback oficial — ver DS-05 2026-09-09).

---

## 4. Fluxo Visual QA (homolog P0)

| ID | Ferramenta |
|---|---|
| DS-05 shells `/eventos`, `/newsletter` | `_audit.mjs` + Playwriter amostragem OAuth se necessário |
| QA-ADM-07..09 | **Playwriter** |
| QA-ANON-10 | **Playwriter** (CTA → `/login`) |
| QA-CAND-01 | **Playwriter** (OAuth — humano confirma conta) |
| Debug console pontual | chrome-devtools-mcp (escopo mínimo) |

Registrar resultados em [`qa-security-assessment.md`](qa-security-assessment.md) — **não só no chat** ([`contributing.md`](contributing.md) § ressalvas).

---

## Troubleshooting

| Problema | Ação |
|---|---|
| Playwriter aba cinza | Clicar extensão na aba alvo |
| Agente estourando tokens | Parar MCP browser no chat; usar Playwriter CLI + `_audit.mjs` |
| MCP chrome-devtools offline | **Não bloqueia** DS-05 — rodar `_audit.mjs` |
| `_audit.mjs` falha “Dev server offline” | `pnpm dev` em `127.0.0.1:5173` |
| `_audit.mjs` “Executable doesn't exist” | `pnpm exec playwright install chromium` |
| Tema não muda | ThemeToggle no Header; `html[data-theme]` |

---

## Referências

- [`AGENTS.md`](../AGENTS.md) — mapa Executor frontend vs Visual QA
- DS-06 / DS-07 — [`design-system-communication.md`](design-system-communication.md), [`section-curves.md`](design-system/section-curves.md)
