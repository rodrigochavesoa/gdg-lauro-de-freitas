# Guideline — ciclo de vida de credenciais (modelo)

Copie o conteúdo operacional para `docs-local/` após clonar o repositório. A versão completa do squad GDG Jobs **não** é versionada — fica em `docs-local/guideline-credentials-lifecycle.md` na cópia local do mantenedor.

## O que o modelo cobre

- classificação de credenciais (público / confidencial / privilegiado);
- `.gitignore` e `.env.example` desde o primeiro commit;
- Secret Scanning + Push Protection no GitHub;
- pre-commit e revisão de PR;
- isolamento de Environment secrets (sem privilégios em `pull_request`);
- auditoria de histórico, PRs, Actions e artefatos;
- playbook de revogação e rotação;
- por que testes funcionais (ex.: RLS) não detectam vazamento histórico.

## Arquivos relacionados na cópia local

| Arquivo local | Conteúdo |
|---|---|
| `docs-local/security-project-bootstrap.md` | Setup inicial: ruleset, Environments, CI, checklists |
| `docs-local/guideline-credentials-lifecycle.md` | Guideline humano (mantenedor / PO) |
| `docs-local/guideline-agents-secret-hygiene.md` | Regras para agents + critério YAML |
| `docs-local/sec-secrets-history-audit-01.md` | Relatório de auditoria histórica (quando executada) |

## Referências públicas

- [GitHub Secret Scanning](https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning)
- [GitHub Push Protection](https://docs.github.com/en/code-security/concepts/secret-security/push-protection)
- [Supabase — API keys](https://supabase.com/docs/guides/api/api-keys)
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) e [`SETUP.md`](../SETUP.md) — CI e proteção de `main`

**Nunca** colar valores reais de secrets neste arquivo nem no Git público.
