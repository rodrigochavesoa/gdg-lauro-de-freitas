# DS-05 — evidências Visual QA (`/eventos` + `/newsletter`)

Gerado pelo Frontend Visual QA.

| Item | Valor |
|---|---|
| URL | `http://127.0.0.1:5173` |
| Script | `_audit.mjs` |
| Runner | `run-audit.ps1` |
| Ferramenta padrão | **Playwriter CLI** (interativo) + **este script** (regressão repetível) |
| MCP browser no chat | **Evitar** — snapshots consomem tokens; usar script + arquivos |
| Logado | staff `/admin` (`docs-local/admin-test-user.md`, não commitado) |

## Executar

```powershell
pnpm dev   # terminal 1
pwsh -File docs/assets/ds-05-eventos-newsletter/run-audit.ps1
```

Saída: PNGs nesta pasta + `audit-log.json`. Sucesso: `"pass": true` no JSON.

Política: [`docs/setup-visual-qa-tools.md`](../../setup-visual-qa-tools.md) § *Política de tokens*.
