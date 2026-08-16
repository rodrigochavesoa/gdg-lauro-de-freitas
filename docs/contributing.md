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

## Proteção recomendada em `main` (GitHub)

Ação humana: exigir PR, status check **CI**, bloquear push direto, preferir squash merge.
