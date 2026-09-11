# docs-local — modelo (copiar para uso local)

Esta pasta **é commitada** apenas como **exemplo**. Copie para `docs-local/` na raiz do repositório.

```powershell
Copy-Item -Recurse docs-local.example docs-local
```

Se o clone ainda tiver `docs/` no histórico local (antes deste recorte público):

```powershell
pwsh scripts/migrate-docs-to-local.ps1
```

A pasta `docs-local/` está no `.gitignore` e **não** vai para o GitHub. `AGENTS.md` na raiz e `.cursor/` também estão ignorados — use as cópias em `docs-local/`.

## Estrutura sugerida

```
docs-local/
  AGENTS.md                 ← papéis Plan / Executor / Visual QA (copie AGENTS.md.example)
  cursor/
    rules/                  ← rules Cursor (cópia local; ver cursor/rules/README.md)
    mcp.json
  assets/                   ← evidências Visual QA (PNG, audit-log.json)
  design-system/            ← DS-06/DS-07 e referências
  *-test-user.md            ← credenciais de homologação (nunca commitar)
  contributing.md           ← se migrou do docs/ antigo (a pública é CONTRIBUTING.md na raiz)
```

## O que pode ficar em docs-local/

- Anotações operacionais **sem** colar segredos quando evitável (preferir “entregue via 1Password em DD/MM”).
- Backlog, assessment QA, runbooks, design system.
- Links internos da equipe (ClickUp, Trello) se forem restritos.

## O que NÃO deve estar nem em docs-local/ sem controle

- Dados pessoais reais de usuários ou candidatos.
- Exports de banco com PII.
- Arquivos compartilhados por e-mail público — usar canal seguro.

Stubs neste exemplo **não** republicam o backlog. Quem já tinha `docs/` no disco: rode o script de migração **antes** de apagar a pasta do working tree.
