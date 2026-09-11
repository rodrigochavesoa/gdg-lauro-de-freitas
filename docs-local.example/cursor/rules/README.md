# Rules Cursor — onde vive cada coisa

| Pasta | Versionada no Git? | Papel |
|---|---|---|
| **`.cursor/`** | **Não** (`.gitignore`) | O que o **Cursor lê** no workspace — copie de `docs-local/cursor/` |
| **`docs-local/cursor/`** | **Não** | Cópia **canônica local** do mantenedor (rules + `mcp.json` se houver) |
| **`docs-local.example/cursor/rules/`** | **Sim** | Só **templates genéricos** para quem clona (ex.: `public-docs-boundary.mdc`) |

A pasta `.cursor/` **não vai para o GitHub** de propósito (GOV-REPO-01): pode conter `mcp.json` com tokens e rules operacionais do squad.

## Sincronizar `.cursor/` (mantenedor)

```powershell
New-Item -ItemType Directory -Force .cursor/rules
Copy-Item -Force docs-local/cursor/rules/*.mdc .cursor/rules/
# opcional: mcp.json / settings (cuidado com segredos)
# Copy-Item docs-local/cursor/mcp.json .cursor/ -ErrorAction SilentlyContinue
```

Quem clona o repo **público** não recebe `.cursor/` nem `docs-local/cursor/` — copia o template versionado e preenche o local:

```powershell
Copy-Item docs-local.example/cursor/rules/public-docs-boundary.mdc .cursor/rules/
# demais rules: migrate-docs-to-local.ps1 ou canal interno do mantenedor
```

Arquivos esperados (após migração do clone do mantenedor):

- **`public-docs-boundary.mdc`** — regra de ouro (sempre ativa): doc operacional → `docs-local/`; inspecionar repo antes de criar arquivos
- `executor-frontend.mdc`
- `frontend-visual-qa.mdc`
- `frontend-section-curves.mdc`

Copiar a regra de ouro para o Cursor (obrigatório para agentes):

```powershell
New-Item -ItemType Directory -Force .cursor/rules
Copy-Item docs-local.example/cursor/rules/public-docs-boundary.mdc .cursor/rules/
```

Quem parte só deste exemplo: rode `pwsh scripts/migrate-docs-to-local.ps1` num checkout que ainda tenha `.cursor/` no histórico, ou peça as rules ao mantenedor por canal interno.

DS público para PRs de UI: tokens em `src/styles.css`. Texto completo DS-06/DS-07 fica em `docs-local/`.
