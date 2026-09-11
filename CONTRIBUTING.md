# Contribuição — GDGJobs

Padrões da comunidade para branch, Pull Request e mensagens de commit.

Documentação **pública** (este arquivo, `README.md`, `SETUP.md`, `LICENSE`) fica no Git. Backlog, design system, evidências QA e rules de agentes ficam em `docs-local/` (gitignored) — modelo em `docs-local.example/`.

**ClickUp (comunicação humana):** sprints e status para PO/stakeholders — setup em [`docs-local.example/clickup/setup.md`](docs-local.example/clickup/setup.md). Configs operacionais em `docs-local/clickup/` (gitignored); sync: `pnpm clickup:sync` (token em `docs-local/clickup.env`). Cada PR inclui `ClickUp: CU-xxx` no corpo (ver [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md)). Integração GitHub continua **manual** (OAuth). Execução técnica permanece ONE-LINER + Cursor + GitHub.

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

**Regra do Executor:** criar a branch (**etapa 2**) **antes** de editar qualquer arquivo de código ou documentação versionada. Trabalhar somente na branch da história. **Nunca** commitar em `main` local — push direto em `main` é bloqueado pelo ruleset.

Template de PR: [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md).

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
| **1. Infra e segurança** | Manuais de ambiente, políticas de segredos, decisões de hospedagem, templates `.env.example` globais — ex.: `docs-local/supabase-dev-env.md`, `docs-local/security-and-documentation.md`, `SETUP.md` | PR **`chore/…`**, **antes** ou **em paralelo** ao código que depende delas. Docs operacionais ficam em `docs-local/` (não versionado) |
| **2. Integração funcional** | Código, migration, testes, script de validação (ex.: RLS) e **documentação estrita da feature** (docstrings, schemas de API, README do módulo, `docs-local/s2-catalog-rls.md` ligado à migration da mesma entrega) | PR `feat/…` / `fix/…` — código e doc **interna da feature** no **mesmo PR** para não defasar |
| **3. Governança e backlog** | Revisão Tech Lead, atualização de `docs-local/project-backlog-scrum.md`, aprovações de sprint, registro de ADR aceita | PR **`chore/`** separado **ou** atualização só local em `docs-local/`; alternativa: corpo do squash merge **após** merge do PR funcional — **não** misturar com `feat/` |

**Ressalva — docs de infra vs. docs da feature**

- **Infra/segurança/arquitetura** (ambiente, políticas, decisões transversais): PR separado (item 1).
- **Documentação técnica da própria feature** (contrato da API, schema, doc do módulo, rollback da migration entregue): permanece no PR funcional (item 2).

**Ressalva — revisão Tech Lead**

- Registros de aprovação de sprint e atualizações de backlog **não inflam** PRs funcionais.
- Preferir PR de governança (`chore(process): …`, `docs(backlog): …`) ou registrar a revisão no merge commit / PR doc imediatamente após o squash do `feat/`.

### Anti-padrão observado (Sprint 2)

O PR #4 misturou integração Supabase com docs de ambiente/segurança também presentes no PR #3, gerando overlap e PR **grande**. Da Sprint 3 em diante: mergear ou fechar o PR de infra **antes** do `feat/` dependente, ou rebasear para eliminar duplicação.

## Handoff ONE-LINER ao Executor (Tech Lead)

O Tech Lead publica **um único bloco** copiável — sem exigir seleção parcial na conversa. Formato fixo:

```md
### ONE-LINER AO EXECUTOR

**Função / Agente:** (obrigatório) quem executa — ex.: Executor frontend, **Frontend Visual QA**, Executor / Shell (pwsh), Humano (PO), subagent security-review, Plan Tech Lead only
**Modelo / ferramenta:** (obrigatório quando agente ≠ humano) ex.: sem LLM · Cursor Agent standard · raciocínio alto (só Plan)
**Perfil:** ... (opcional — competência: Fullstack Engineer, etc.)
**História:** Sx-xx — ...
**Tarefa:** ...
**Branch:** feat/... ou docs/...
**Squash merge:** tipo(escopo): descrição
**Critério de pronto:**
- ...
**Fora de escopo:**
- ...
**Dependências humanas:**
- ...
**Referências obrigatórias:**
- ... (UI Executor: `docs-local/design-system-communication.md` — **DS-06** + `docs-local/design-system/section-curves.md` — **DS-07**; tokens públicos em `src/styles.css`)
- ... (Visual QA: [`docs-local/AGENTS.md`](docs-local/AGENTS.md) + [`docs-local/setup-visual-qa-tools.md`](docs-local/setup-visual-qa-tools.md) + rule local `docs-local/cursor/rules/frontend-visual-qa.mdc`)
```

Regras: bloco completo entre \`\`\`md e \`\`\`; critérios em lista; branch e título de squash explícitos; detalhes longos no backlog (`docs-local/project-backlog-scrum.md`), não espalhados no chat.

**Regra de ouro (ONE-LINER — função do executor):** todo ONE-LINER **deve** declarar explicitamente **quem executa** (`**Função / Agente:**`) e, quando o agente não for humano puro, **como executa** (`**Modelo / ferramenta:**`). ONE-LINER **sem** esses campos é **inválido** — o Executor **não inicia**; o Plan republica o bloco completo antes de dar **Sim**.

## Papéis — Plan Tech Lead vs Executor (obrigatório)

Respeitar a função de cada agente. **Confusão de papéis invalida a entrega** (ex.: baseline QA preenchido pelo Plan sem reexecução do Executor).

| Papel | Faz | **Não faz** |
|---|---|---|
| **Executor frontend** | ONE-LINER de UI; implementar; Vitest/smoke; `lint`/`test`/`build`; PR após **Sim** | Auditoria visual browser; parecer “layout ok” só lendo TSX; preencher assessment *Pass* sem evidência |
| **Frontend Visual QA** | ONE-LINER de homolog/DS-05; **Playwriter CLI** + scripts (`_audit.mjs`); screenshots light/dark em `docs-local/assets/`; relatório + assessment — **não** browser MCP no chat (§ tokens em [`docs-local/setup-visual-qa-tools.md`](docs-local/setup-visual-qa-tools.md)) | Implementar features; push em `main`; substituir Plan; Playwright MCP; auditoria completa via chrome-devtools-mcp no chat |
| **Plan Tech Lead** | ONE-LINER; **revisão** de entregas do Executor (aprovar / reprovar / aprovar com ressalvas); diagnóstico; backlog; decisões técnicas; **Sim** antes de push/PR | **Executar** `pnpm test`, `pnpm test:rls`, `pnpm lint`, `build`; editar código de produto; preencher assessment/checklist de execução; commit; push; abrir PR de implementação |
| **Executor** | Branch → implementar ou **executar** ONE-LINER (comandos, docs preenchidos com log real) → validar → commit na branch → PR após **Sim** | Decisão de negócio; segredos reais; push em `main`; iniciar sem ONE-LINER |
| **Humano (PO/mantenedor)** | C-05, credenciais, merge squash, testes manuais browser quando ONE-LINER pedir; aceite DS-05/PO | — |

**Regra explícita:** se o ONE-LINER diz “Executor roda X”, o **Plan não roda X** — só publica o ONE-LINER e revisa o resultado. Se o Plan executou por engano, o Executor **reexecuta** e corrige artefatos (registrar no PR: “Revalidado pelo Executor”).

**Regra de ouro (Plan Tech Lead):** se o humano pedir ao Plan uma tarefa **fora da função Plan** (executar comandos, implementar, preencher assessment/checklist de execução, commit, push, PR de código/docs preenchidos por execução), o Plan **recusa educadamente**, **não executa**, e responde com **ONE-LINER completo** para o agente correto (Executor, Shell, Humano ou subagent indicado). Nunca “fazer rápido” por conveniência.

**Exceção:** tarefa rotulada **“Plan Tech Lead only”** no ONE-LINER (ex.: revisão de PR, parecer de merge, atualização de backlog pós-merge) — aí o Executor **não** substitui o Plan.

### Revisão Plan (padrão de parecer)

Quando o Executor reporta **“pronto na branch / PR #N”**, o Plan **revisa** (sem reexecutar, salvo amostragem opcional do humano):

| Veredito | Quando usar |
|---|---|
| **APROVADO** | ONE-LINER cumprido; CI verde; escopo isolado; critérios de aceite ok |
| **APROVADO com ressalvas** | Entrega válida; polish ou follow-up documentado (não bloqueia merge se P0 ok) |
| **REPROVADO** | Fora de escopo; falha CI; critério P0 não atendido; divergência do ONE-LINER; **ONE-LINER sem `Função / Agente` (e `Modelo / ferramenta` quando couber)** |

Formato: tabela critério × resultado + veredito final + squash sugerido (se aprovado). Registrar revisões relevantes em `docs-local/project-backlog-scrum.md` quando for marco de sprint.

**Ressalva não bloqueante ≠ “só no chat”.** Se ficar só na conversa, vira **dívida técnica invisível** — ninguém executa, ninguém fecha. Toda ressalva do Plan **deve** sair do chat no mesmo ciclo de revisão (antes ou no merge).

#### Onde registrar ressalvas (obrigatório)

| Tipo de ressalva | Onde registrar | Quem executa | Quando fechar |
|---|---|---|---|
| **Polish P2/P3** (UX, DRY, doc menor) | Tabela **Polish / follow-up opcional** em [`docs-local/project-backlog-scrum.md`](docs-local/project-backlog-scrum.md) — linha com **ID** (ex.: `PERF-CAT-02`, `DRY-STAFF`) | Executor em sprint futuro ou PO prioriza | Item removido ou marcado concluído no backlog + PR de closeout |
| **Follow-up técnico** (medir de novo, script, baseline) | Mesma tabela no backlog **ou** ONE-LINER dedicado se tiver critério de pronto | Executor | Critério do ONE-LINER atendido |
| **Finding resolvido** (F-xxx) | [`docs-local/qa-security-assessment.md`](docs-local/qa-security-assessment.md) — seção *Findings resolvidos* | Já mergeado | Assessment atualizado localmente (não versionar) |
| **QA manual pendente** | [`docs-local/qa-test-plan-homolog.md`](docs-local/qa-test-plan-homolog.md) + coluna *Resultado* no assessment | **Humano** PO/QA | Linha *Pass* com evidência no assessment |
| **Decisão do merge** (incluir arquivo, nota metodológica) | **Corpo do PR** — seção `## Ressalvas (não bloqueantes)` | Executor no merge ou PR doc follow-up | PR mergeado com seção preenchida |
| **Trabalho novo com escopo** | **ONE-LINER** ao Executor (história nova, branch, critérios) | Executor | Revisão Plan APROVADO |
| **Marco de sprint / handoff** | [`docs-local/project-backlog-scrum.md`](docs-local/project-backlog-scrum.md) § *Handoff* | Plan TL | Próximo handoff referencia PRs e pendências |

#### Regra anti-dívida (Plan + Executor + PO)

1. **Plan:** em **APROVADO com ressalvas**, listar ressalvas numeradas (`R1`, `R2`…) e **apontar o destino** de cada uma (backlog ID, ONE-LINER, PR body, humano).
2. **Executor:** antes do merge, copiar ressalvas `R*` para o destino indicado; **não** fechar PR só com “ok no chat”.
3. **PO:** revisar tabela *Polish / follow-up* no handoff; ressalva sem linha no backlog = **dívida não rastreada** — reabrir com Plan.
4. **Chat:** serve para **decisão imediata** (Sim / não commitar); **não** substitui registro durável.

#### Exemplo (parecer Plan)

```md
**Veredito:** APROVADO com ressalvas

| R | Ressalva | Destino |
|---|---|---|
| R1 | Mediana cold load home >900 ms | Backlog `PERF-CAT-02` (P2) |
| R2 | Playwright homolog não rodou | Humano QA-ADM-07..09 |
| R3 | `STAFF_ROLES` duplicado | Backlog `DRY-STAFF` (P3) |
```

**Sim** para commit/merge — desde que R1 e R3 estejam no backlog antes do squash (ou no PR #46 doc-only).

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

## Higiene de branches (obrigatório após merge ou fechamento de PR)

Evitar “lixo visual” local e remoto. **Tech Lead ou mantenedor** revisa branches ao fechar sprint ou mergear PR.

| Situação | Ação |
|---|---|
| PR **mergeado** ou **fechado** | Apagar branch remota e local da feature |
| PR **aberto** | Manter só `main` + branch do PR ativo |
| Branch local com `[gone]` no tracking | `git fetch --prune` → apagar local |

Comandos (`pwsh`), após `git checkout main` e `git pull origin main`:

```powershell
git fetch --prune origin
git branch -vv
git branch -r --merged origin/main
git branch -r --no-merged origin/main
# Apagar local (mergeada ou obsoleta):
git branch -d nome-da-branch
# Se Git recusar e a branch estiver obsoleta:
git branch -D nome-da-branch
# Apagar remota:
git push origin --delete nome-da-branch
```

**Estado saudável:** `main` + no máximo uma branch por PR aberto (ex.: `docs/backlog-s3-handoff` enquanto o PR #6 estiver aberto).

## Proteção de `main` (GitHub) — habilitada em 2026-08-16

Ruleset **Protect main** (id `20903173`): PR obrigatório, check **Lint, test and build**, sem force-push e sem exclusão de `main`. Squash merge é o único método permitido no repositório.

Evidência (mantenedor): [`docs-local/s1-04-branch-protection.md`](docs-local/s1-04-branch-protection.md). UI: https://github.com/rodrigochavesoa/gdg-lauro-de-freitas/rules/20903173

