# Setup inicial de segurança para novos projetos (modelo)

Copie o conteúdo operacional para `docs-local/security-project-bootstrap.md` após clonar o repositório. A versão completa do squad **não** é versionada.

## O que o modelo cobre

- perguntas obrigatórias ao mantenedor antes de codar;
- ruleset da branch principal (PR, squash, checks, force push bloqueado);
- Environments (`homolog-rls`, `Preview`, `Production`);
- CI seguro (sem privilégios em PR; jobs privilegiados pós-merge);
- classificação e regras de secrets;
- checklists de commit e PR;
- playbook de resposta a vazamento;
- critério YAML de setup concluído.

## Arquivos relacionados na cópia local

| Arquivo local | Conteúdo |
|---|---|
| `docs-local/security-project-bootstrap.md` | Setup inicial de segurança (este modelo expandido) |
| `docs-local/guideline-credentials-lifecycle.md` | Ciclo de vida humano de credenciais |
| `docs-local/guideline-agents-secret-hygiene.md` | Regras para agents + YAML de conclusão |
| `docs-local/guideline-agents-project-bootstrap.md` | Guideline operacional completo para agents |

## Referências públicas

- [GitHub Environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning)
- [GitHub Push Protection](https://docs.github.com/en/code-security/concepts/secret-security/push-protection)
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) e [`SETUP.md`](../SETUP.md)

**Nunca** colar valores reais de secrets neste arquivo nem no Git público.
