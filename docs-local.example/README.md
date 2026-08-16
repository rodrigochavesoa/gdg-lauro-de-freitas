# docs-local — modelo (copiar para uso local)

Esta pasta **é commitada** apenas como **exemplo**. Copie para `docs-local/` na raiz do repositório.

```powershell
Copy-Item -Recurse docs-local.example docs-local
```

A pasta `docs-local/` está no `.gitignore` e **não** vai para o GitHub.

## O que pode ficar em docs-local/

- Anotações operacionais **sem** colar segredos quando evitável (preferir “entregue via 1Password em DD/MM”).
- Links internos da equipe (ClickUp, Trello) se forem restritos.
- Rascunhos de runbook antes de sanitizar para `docs/`.

## O que NÃO deve estar nem em docs-local/ sem controle

- Dados pessoais reais de usuários ou candidatos.
- Exports de banco com PII.
- Arquivos compartilhados por e-mail público — usar canal seguro.

## Estrutura sugerida (opcional)

```
docs-local/
  README.md              ← este arquivo, adaptado
  credentials-log.md     ← quem recebeu o quê, quando (sem colar chaves)
  onboarding-pessoal.md  ← notas só do mantenedor
```

Política completa: [`docs/security-and-documentation.md`](../docs/security-and-documentation.md).
