# Setup — Ferramentas Frontend Visual QA

**Agente:** Frontend Visual QA · **Rule:** [`.cursor/rules/frontend-visual-qa.mdc`](../.cursor/rules/frontend-visual-qa.mdc)  
**Matriz:** [`qa-test-plan-homolog.md`](qa-test-plan-homolog.md) · **Saída:** [`qa-security-assessment.md`](qa-security-assessment.md)

Este guia adota a stack acordada para eliminar o “ponto cego” visual (validação só por TSX/linter/Vitest).

## Stack (ordem de uso)

| Prioridade | Ferramenta | Quando usar | Windows |
|---|---|---|---|
| **1** | [Playwriter](https://github.com/remorses/playwriter) | Homolog interativo: OAuth Google, admin logado, light/dark, cliques reais no **seu Chrome** | ✅ |
| **2** | [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) | Console, rede, screenshots, perf — sessão Visual QA no **Cursor** | ✅ |
| **3** | Playwright (devDependency) | Scripts repetíveis (`pnpm qa:admin-nav`), medição perf | ✅ |
| **4** | Humano (PO) | Aceite DS-05, julgamento estético final | ✅ |
| — | [dev-browser](https://github.com/SawyerHood/dev-browser) | **Não adotado** — Windows ainda não suportado upstream | ❌ |

## Pré-requisitos comuns

```powershell
cd c:\Colab_Developer\gdg-senai
pnpm install
pnpm exec playwright install chromium   # após playwright em devDependencies
```

App local (terminal separado):

```powershell
pnpm dev
# URL padrão: http://127.0.0.1:5173
```

Credenciais de teste (gitignored): `docs-local/admin-test-user.md`, `docs-local/candidate-test-user.md`.

---

## 1. Playwriter (homolog com sessão real)

Playwriter controla **seu Chrome** via extensão — ideal para Google OAuth e admin já logado.

### Instalação (uma vez)

1. **Extensão Chrome:** [Chrome Web Store — Playwriter](https://chromewebstore.google.com/) (ou link em [playwriter.dev](https://playwriter.dev)).
2. **CLI global:**
   ```powershell
   npm install -g playwriter
   ```
3. **Skill do agente (opcional, recomendado):**
   ```powershell
   npx -y skills add https://playwriter.dev
   ```

### Uso rápido

1. Abra `http://127.0.0.1:5173` no Chrome.
2. Clique no ícone Playwriter na aba → fica **verde** (aba controlada).
3. Terminal:
   ```powershell
   playwriter session new
   playwriter -s 1 -e 'await page.goto("http://127.0.0.1:5173")'
   playwriter -s 1 -e 'console.log(await page.title())'
   ```

### Light / Dark (GDGJobs)

Tema via `data-theme` no `<html>` — alternar pelo **ThemeToggle** no Header (Claro / Escuro), depois screenshot:

```powershell
playwriter -s 1 -e 'await screenshotWithAccessibilityLabels({ page })'
```

### MCP (opcional)

Ver [MCP.md](https://github.com/remorses/playwriter/blob/main/MCP.md) no repositório Playwriter. Preferir CLI + skill para homolog GDGJobs.

---

## 2. chrome-devtools-mcp (Cursor)

MCP oficial Google — inspeção, screenshots, automação via Puppeteer.

### Configuração no projeto

O arquivo [`.cursor/mcp.json`](../.cursor/mcp.json) já declara o servidor. Após pull:

1. **Cursor** → Settings → MCP → recarregar servidores (ou reiniciar Cursor).
2. Confirmar que `chrome-devtools` aparece **conectado**.
3. Sessão **Frontend Visual QA**: acionar rule `frontend-visual-qa` e pedir auditoria de `http://127.0.0.1:5173`.

Flags usadas: `--slim --headless --no-usage-statistics` (menos tokens, sem telemetria).

### Prompt de smoke no Cursor

```
Audite http://127.0.0.1:5173 — light e dark (ThemeToggle), console sem erros,
screenshot da Home e QA-ANON-10 (CTA Criar perfil gratuito).
```

Documentação: [Chrome DevTools for agents](https://developer.chrome.com/docs/devtools/agents).

---

## 3. Playwright (scripts repetíveis)

Medição perf admin (não substitui homolog visual interativo):

```powershell
pnpm dev   # terminal 1
pnpm qa:admin-nav   # terminal 2
```

Script: [`scripts/measure-admin-nav.mjs`](../scripts/measure-admin-nav.mjs) — T1/T2/T3, spinner 0/5, `rest/v1` no remount.

**Não entra no CI** por padrão (requer `docs-local/` + dev server).

---

## 4. Fluxo Visual QA (homolog P0)

Checklist imediato pós-setup:

| ID | Ferramenta sugerida |
|---|---|
| QA-ADM-07..09 | Playwriter ou chrome-devtools-mcp |
| QA-ANON-10 | Playwriter (CTA → `/login`) |
| QA-CAND-01 | Playwriter (OAuth — humano confirma conta) |
| Demais P0 *manual* | Matriz + assessment |

Registrar resultados em [`qa-security-assessment.md`](qa-security-assessment.md) — **não só no chat** ([`contributing.md`](contributing.md) § ressalvas).

---

## Troubleshooting

| Problema | Ação |
|---|---|
| Playwriter aba cinza | Clicar extensão na aba alvo |
| MCP chrome-devtools offline | `npx -y chrome-devtools-mcp@latest --help` no terminal; reiniciar Cursor |
| `pnpm qa:admin-nav` falha | `pnpm exec playwright install chromium`; `pnpm dev` rodando |
| Tema não muda | Usar ThemeToggle no Header; verificar `html[data-theme]` no DevTools |

---

## Referências

- [`AGENTS.md`](../AGENTS.md) — mapa Executor frontend vs Visual QA
- DS-06 / DS-07 — [`design-system-communication.md`](design-system-communication.md), [`section-curves.md`](design-system/section-curves.md)
