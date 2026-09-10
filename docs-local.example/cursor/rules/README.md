# Rules Cursor — somente local

A pasta `.cursor/` **não** é versionada. Copie as rules para o lugar que o Cursor lê **ou** mantenha o arquivo canônico em `docs-local/cursor/rules/`.

```powershell
# Após migrate-docs-to-local.ps1, as rules já estão em docs-local/cursor/rules/
# Para o Cursor aplicar no workspace (opcional):
Copy-Item -Recurse docs-local/cursor $PWD/.cursor
```

Arquivos esperados (após migração do clone do mantenedor):

- `executor-frontend.mdc`
- `frontend-visual-qa.mdc`
- `frontend-section-curves.mdc`

Quem parte só deste exemplo: rode `pwsh scripts/migrate-docs-to-local.ps1` num checkout que ainda tenha `.cursor/` no histórico, ou peça as rules ao mantenedor por canal interno.

DS público para PRs de UI: tokens em `src/styles.css`. Texto completo DS-06/DS-07 fica em `docs-local/`.
