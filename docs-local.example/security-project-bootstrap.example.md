# Setup inicial de segurança para novos projetos (modelo)

Copie o conteúdo operacional para `docs-local/security-project-bootstrap.md` após clonar o repositório. A versão completa do squad **não** é versionada.

## O que o modelo cobre

- perguntas obrigatórias ao mantenedor antes de codar;
- ruleset da branch principal (PR, squash, checks, force push bloqueado);
- Environments (`homolog-rls`, `Preview`, `Production`);
- CI seguro (sem privilégios em PR; jobs privilegiados pós-merge);
- baseline de segurança para workflows de CI desde o Dia 0;
- classificação e regras de secrets;
- checklists de commit e PR;
- playbook de resposta a vazamento;
- critério YAML de setup concluído.

## Checklist Dia 0 — GitHub Actions e CI

Aplicar a cada workflow novo e revisar os workflows existentes. O objetivo é reduzir privilégios e a exposição de credenciais durante setup, instalação e testes; isso não torna seguro executar código não confiável em um job privilegiado.

1. **Permissões mínimas:** declarar `permissions` explicitamente no workflow e restringir permissões por job quando necessário. Começar sem permissões de escrita e conceder apenas os escopos realmente usados, por exemplo `contents: read` para checkout.
2. **Actions fixadas:** referenciar Actions de terceiros por SHA completo de 40 caracteres e manter a tag de versão em comentário para leitura. Atualizar SHAs por Dependabot ou Renovate, com CI e revisão antes do merge.
3. **Checkout sem credencial persistida:** configurar `persist-credentials: false` no `actions/checkout` sempre que os passos posteriores não precisarem de Git autenticado. O checkout padrão pode deixar o token do workflow na configuração Git local após o step.
4. **Secrets no menor escopo:** passar cada secret somente no step que o consome. Para credenciais privilegiadas, usar um job separado protegido por GitHub Environment, limitar os eventos/ref que o iniciam e nunca executar código de PR não confiável nesse job. Instalar dependências antes do step privilegiado e revisar os comandos executados nesse step.
5. **Teste de regressão:** adicionar teste automatizado adaptado à estrutura do repositório que falhe se houver secret em escopo de workflow/job/setup indevido, permissões além do necessário, Action sem SHA ou checkout privilegiado sem `persist-credentials: false`. Validar todos os workflows relevantes, não apenas o que motivou a mudança.
6. **Template reutilizável:** se vários repositórios da organização compartilham o padrão, manter um workflow-base em um repositório `.github` da organização (`workflow-templates/`) ou em um repositório starter; atualizar o template e o teste juntos.

### Critério de conclusão do setup de CI

- [ ] Cada workflow tem permissões explícitas e mínimas.
- [ ] Actions externas estão fixadas por SHA completo; automação de atualização mantém os SHAs sob revisão.
- [ ] Checkouts não persistem credenciais quando o job não precisa de Git autenticado depois do checkout.
- [ ] Secrets estão limitados ao step consumidor e, se privilegiados, a job/environment e eventos/ref confiáveis.
- [ ] Testes cobrem a política nos workflows versionados e passam na CI.
- [ ] PR registra quais workflows e secrets foram revisados, sem incluir valores secretos.

**Limite importante:** secrets em nível de step impedem que steps anteriores os leiam diretamente do ambiente, mas não neutralizam código malicioso que possa modificar arquivos compartilhados e influenciar um step privilegiado posterior. Por isso, o job com secrets deve executar apenas código confiável e comandos revisados.

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
