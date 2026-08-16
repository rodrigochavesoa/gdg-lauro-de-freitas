# Segurança da documentação — o que pode ir ao Git

**Regra:** informação **sensível nunca** entra em arquivos commitados (`docs/`, `README`, código, PRs, issues públicas). Quem trabalha no projeto precisa de documentação de processo — **não** de segredos nem dados de titulares reais no repositório.

## Proibido commitar (lista mínima)

| Categoria | Exemplos |
|---|---|
| Credenciais | Senhas, API keys, tokens JWT reais, `service_role`, `sb_secret_...`, OAuth client secrets |
| Conexão com segredo | URLs com token embutido, connection strings completas |
| Dados pessoais reais | E-mails, nomes, CPF, currículos, exports de usuário, dumps de banco |
| Operacional interno sensível | Planilhas de acesso, canal onde a senha foi enviada, backup com PII |
| Ambiente preenchido | `.env`, `.env.local`, `.env.production` com valores |

## Permitido commitar

| Categoria | Exemplos |
|---|---|
| Processo e arquitetura | Backlog, ADRs, fluxos, LGPD **inventário com dados fictícios** |
| Templates vazios | [`.env.example`](../.env.example) — **somente nomes** de variáveis |
| Evidência não sensível | Screenshot de ruleset (sem tokens), IDs públicos de projeto |
| Dados fictícios explícitos | Fixtures de demo claramente marcadas como fictícias |

## Pasta local `docs-local/` (não versionada)

Notas operacionais que **não** devem circular no Git ficam em **`docs-local/`** na raiz do projeto. Essa pasta está no [`.gitignore`](../.gitignore) e **nunca** é pushada.

**Uso típico (só na máquina do mantenedor / canal seguro da equipe):**

- registro de **onde** as credenciais de teste foram entregues (sem colar a chave no doc, se possível);
- checklist pessoal de onboarding com links internos;
- anotações de incidente em andamento;
- cópias de export **anonimizados** para análise local.

**Modelo de estrutura:** copie [`docs-local.example/`](../docs-local.example/) para `docs-local/`:

```powershell
Copy-Item -Recurse docs-local.example docs-local
```

Cada colaborador autorizado mantém sua própria `docs-local/` local. **Não** sincronizar via repositório.

## Onde guardar segredos de verdade

| Tipo | Onde |
|---|---|
| Frontend (teste) | `.env.local` (gitignored) |
| CI / Vercel preview | Painel Vercel (env vars), nunca no repo |
| Supabase Edge Functions | Supabase Dashboard → Secrets |
| Compartilhar com Executor | Canal seguro (1Password, DM cifrado, gestor aprovado pelo PO) — **nunca** issue/PR/commit |

## Revisão de PR

Revisor e Executor verificam:

- [ ] Nenhum valor em `.env*` além de `.env.example`
- [ ] Nenhuma chave, token ou senha em markdown, comentários ou fixtures
- [ ] Nenhum dado pessoal real em seed ou documentação
- [ ] Evidências (prints) sem credenciais visíveis

Se algo sensível foi commitado: **rotacionar** a credencial exposta, remover do histórico se necessário (ação do mantenedor) e não repetir.

## Referências

- Ambiente Supabase de teste (sem valores): [`supabase-dev-env.md`](supabase-dev-env.md)
- Inventário LGPD (fictício / planejado): [`lgpd-data-inventory.md`](lgpd-data-inventory.md)
- Contribuição e PR: [`contributing.md`](contributing.md)
