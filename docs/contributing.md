# Contribuição — GDGJobs

Padrões da comunidade para branch, Pull Request e mensagens de commit.

## Git — branch e PR

**`main` é branch protegida.** O Executor Agent **nunca** commita, faz merge ou `git push origin main`.

| Etapa | Comando / ação |
|---|---|
| 1. Atualizar base | `git checkout main` → `git pull origin main` |
| 2. Branch | `git checkout -b docs/s1-04-pr-conventions` (prefixos: `feat/`, `fix/`, `chore/`, `docs/`) |
| 3. Validar (`pwsh`) | `pnpm lint` → `pnpm test` → `pnpm run build` |
| 4. Publicar | `git push -u origin <branch>` — **somente a branch** |
| 5. Revisão | PR **base: `main`** ← compare: `<branch>` |
| 6. Merge | Squash merge pelo **mantenedor** após CI verde e revisão |

Template de PR: [`.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md).

## Tamanho e escopo do Pull Request

Cada PR deve ser **uma entrega coesa**. Para facilitar revisão e rastreabilidade, classifique o tamanho e separe tipos de mudança conforme a tabela abaixo.

### Classificação de tamanho

| Tamanho | Linhas (+/−) | Arquivos | Escopo | Revisão típica |
|---|---|---|---|---|
| **Pequeno** | até ~150 | 1–5 | Uma mudança clara (fix, doc pontual, chore) | 10–20 min |
| **Médio** | ~150–400 | 5–10 | Uma história ou pacote docs + código alinhado | 20–45 min |
| **Grande** | 400+ | 10+ | Sprint inteira ou várias preocupações distintas | 45 min+ |

PRs **grandes** são aceitáveis no fechamento de sprint, mas exigem revisão mais cuidadosa (RLS, auth, segredos). Prefira **médio** como padrão.

### Como dividir mudanças (obrigatório da Sprint 3 em diante)

| Tipo | O que incluir | Branch / PR |
|---|---|---|
| **1. Infra e segurança** | Manuais de ambiente, políticas de segredos, decisões de hospedagem, templates `.env.example` globais — ex.: `docs/supabase-dev-env.md`, `docs/security-and-documentation.md`, README de stack | PR **só docs** (`docs/…`) ou `chore/…`, **antes** ou **em paralelo** ao código que depende delas |
| **2. Integração funcional** | Código, migration, testes, script de validação (ex.: RLS) e **documentação estrita da feature** (docstrings, schemas de API, README do módulo, `docs/s2-catalog-rls.md` ligado à migration da mesma entrega) | PR `feat/…` / `fix/…` — código e doc **interna da feature** no **mesmo PR** para não defasar |
| **3. Governança e backlog** | Revisão Tech Lead, atualização de `docs/project-backlog-scrum.md`, aprovações de sprint, registro de ADR aceita | PR **`chore/docs`** ou **`docs/backlog`** separado; alternativa: corpo do squash merge + commit doc pequeno **após** merge do PR funcional — **não** misturar com `feat/` |

**Ressalva — docs de infra vs. docs da feature**

- **Infra/segurança/arquitetura** (ambiente, políticas, decisões transversais): PR separado (item 1).
- **Documentação técnica da própria feature** (contrato da API, schema, doc do módulo, rollback da migration entregue): permanece no PR funcional (item 2).

**Ressalva — revisão Tech Lead**

- Registros de aprovação de sprint e atualizações de backlog **não inflam** PRs funcionais.
- Preferir PR de governança (`chore(process): …`, `docs(backlog): …`) ou registrar a revisão no merge commit / PR doc imediatamente após o squash do `feat/`.

### Anti-padrão observado (Sprint 2)

O PR #4 misturou integração Supabase com docs de ambiente/segurança também presentes no PR #3, gerando overlap e PR **grande**. Da Sprint 3 em diante: mergear ou fechar o PR de infra **antes** do `feat/` dependente, ou rebasear para eliminar duplicação.

## Conventional Commits (obrigatório)

Seguir a [especificação Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0-beta.4/#especifica%c3%a7%c3%a3o):

```
<tipo>[escopo opcional]: <descrição>

[corpo opcional]

[rodapé opcional]
```

### Tipos usados no GDGJobs

| Tipo | Quando usar |
|---|---|
| `feat` | Novo recurso ou comportamento de produto |
| `fix` | Correção de bug |
| `docs` | Só documentação |
| `chore` | Manutenção, organização de ativos, deps de tooling |
| `test` | Testes (sem mudança de produto) |
| `ci` | Pipeline, GitHub Actions, lint config |
| `refactor` | Refatoração sem mudar comportamento |

Escopos recomendados: `lgpd`, `ci`, `jobs`, `auth`, `ui`, `s1-03`, etc.

### Exemplos válidos

```text
docs(lgpd): add S1-03 personal data inventory for DPO review

chore(s1-02): remove duplicate nested favicons package

ci: add eslint vitest and github actions workflow

feat(jobs): connect home listing to approved jobs
```

### Regras

- Descrição curta em **minúsculas** (exceto nomes próprios), **sem ponto final**.
- Um commit = uma intenção coesa (história ou fix isolado).
- `BREAKING CHANGE:` no corpo ou rodapé quando houver incompatibilidade.
- No **squash merge**, o mantenedor usa título no formato Conventional Commits (título do PR ou mensagem editada no merge).
- Commits fora do padrão não entram em Done; o revisor pode pedir rebase ou ajuste do título no merge.

### Histórico bootstrap (não repetir)

Commits iniciais em `main` (S1-01/S1-02) foram exceção autorizada. Da S1-03 em diante: branch + PR + Conventional Commits.

## Definition of Done (Git)

- Branch a partir de `main`; sem push direto em `main`
- Mensagens de commit no padrão Conventional Commits
- PR aberto; CI verde
- Revisão humana e squash merge pelo mantenedor

## Proteção de `main` (GitHub) — habilitada em 2026-08-16

Ruleset **Protect main** (id `20903173`): PR obrigatório, check **Lint, test and build**, sem force-push e sem exclusão de `main`. Squash merge é o único método permitido no repositório.

Evidência: [`docs/s1-04-branch-protection.md`](s1-04-branch-protection.md). UI: https://github.com/rodrigochavesoa/gdg-lauro-de-freitas/rules/20903173

