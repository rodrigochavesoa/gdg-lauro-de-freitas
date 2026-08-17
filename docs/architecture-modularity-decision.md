# ARQ-01 — modularidade do frontend e controle de dívida técnica

**Status:** aceite operacional no PR ARQ-01a/b (`refactor/s5-modularize-app-shell`); Product Owner/Tech Lead confirmam no merge.  
**Decisão:** composição de componentes + módulos por funcionalidade; sem herança de componentes, DDD completo ou arquitetura hexagonal completa no MVP.  
**Escopo inicial:** refatoração sem alteração funcional ou visual, depois do Sprint 4 (`da3d8b3` em `main`).

## Contexto e evidência

O protótipo cresceu de forma natural: lógica de catálogo em `src/lib/`, admin em `src/Admin.jsx`, curadoria em `src/features/curation/`. Antes desta extração, `src/App.jsx` concentrava shell, navegação, Home, filtros, cards, detalhe, Login e Footer.

O risco não é o tamanho em linhas isoladamente, mas a mistura de responsabilidades: uma mudança em Login, catálogo ou detalhe exige alterar o mesmo módulo e é difícil testar cada fluxo de forma independente. No estado atual há um smoke test da Home; os módulos de lógica têm testes unitários, mas as telas não têm cobertura equivalente.

Isso é **dívida estrutural moderada**. Não bloqueia o Sprint 4, mas deve ser resolvida antes de ampliar OAuth, perfil e candidatura no Sprint 5.

## Decisão arquitetural

### Composição é o padrão

Usar componentes pequenos e explícitos, combinados por props, `children` e hooks. Não criar hierarquias de classes ou “componentes base” por herança.

Motivo: React é orientado a composição. Herança aumentaria acoplamento e não separaria os fluxos que hoje estão concentrados em `App.jsx`.

### Organização por funcionalidade

Direção de destino, sem exigir criar todos os diretórios de uma vez:

```text
src/
  app/                     # composição global, rotas e providers
  features/
    catalog/                # Home, filtros, lista e card
    jobs/                   # detalhe da vaga
    auth/                   # Login, sessão e OAuth
    admin/                  # administração de vagas/empresas
    curation/               # fila, rubrica e reenvio (Sprint 4)
  shared/
    ui/                     # Header, Footer e componentes reutilizáveis do DS
    lib/                    # utilitários sem regra de negócio de uma feature
  integrations/
    supabase/               # cliente e adaptadores de infraestrutura
```

Os nomes podem ser ajustados pelo Tech Lead durante a implementação, desde que a separação de responsabilidades seja preservada. Não fazer uma migração mecânica de todos os arquivos para essa árvore sem necessidade.

### Integrações isoladas, sem hexágono formal

Cada feature acessa o Supabase por um adaptador próprio, por exemplo `features/catalog/jobs-api.js` ou `features/curation/curation-api.js`. Componentes de tela não devem montar queries, chamar RPC diretamente nem conhecer detalhes de RLS.

Essa é a parte útil do princípio hexagonal no MVP: proteger a UI da infraestrutura e facilitar testes. Não criar ports, use cases, factories, aggregates ou camadas abstratas sem uma necessidade concreta.

### DDD apenas como linguagem de domínio

Usar os termos do negócio de forma consistente — vaga, empresa, curadoria, parecer, rodada, candidatura e perfil — em código e documentação. Um DDD completo fica fora do escopo até existirem regras de domínio complexas e backend próprio suficiente para justificá-lo.

## Limites de escopo

### Incluído em ARQ-01

- Extrair `Header`, `Footer`, `Home/Catalog`, `JobDetail` e `Login` de `App.jsx`.
- Manter `Admin` isolado e criar `features/curation/` para a entrega de curadoria, sem devolver código de curadoria a `App.jsx`.
- Deixar `App.jsx`/`AppShell` responsável apenas por composição, navegação/rotas e providers.
- Criar testes de caracterização dos fluxos que forem extraídos.
- Separar estilos por feature ou estabelecer uma convenção de seções claramente delimitadas, preservando tokens do Design System.

### Explicitamente fora

- Redesign, migração para Tailwind/shadcn, mudança de tokens ou recriação de componentes.
- Mudança de regras de curadoria, RLS, schema ou contrato Supabase.
- OAuth, perfil, candidatura ou novas funcionalidades no mesmo PR de refactor.
- Migração total para TypeScript, React Router, DDD completo ou hexagonal completo sem decisão específica posterior.

## Sequência de execução

| Etapa | Quando | Entrega | Responsável | Critério de saída |
|---|---|---|---|---|
| ARQ-01a — caracterização | Após S4-02 / início do Sprint 5 | Testes de Home, detalhe, Login e menu mobile | Fullstack Engineer | `src/App.smoke.test.jsx` cobre os quatro fluxos. |
| ARQ-01b — extração | Sprint 5, antes de OAuth | Telas extraídas; `App` só shell | Fullstack Engineer | Sem mudança visual/funcional; lint, testes e build verdes. |
| ARQ-01c — integração Auth | Depois de ARQ-01b | OAuth Google e sessão em `features/auth/` | Fullstack Engineer | Mudança de autenticação não exige editar a implementação de catálogo/detalhe. |
| ARQ-02 — rotas reais | Em PR (`feat/arq-02-router`); confirmar no merge | Adotar `react-router-dom` com URLs para vagas, detalhe, login e admin | Tech Lead + Fullstack Engineer | Decisão registrada em [`arq-02-router.md`](arq-02-router.md) e testes de navegação por URL. |

A entrega de curadoria pode continuar em paralelo somente dentro de `features/curation/` ou módulo equivalente. Não deve alterar `App.jsx` além do ponto mínimo de montagem/navegação.

## História técnica proposta para o backlog

### ARQ-01 — separar o shell das telas do protótipo

**Como** equipe de desenvolvimento, **quero** modularizar as telas e integrações por funcionalidade **para** reduzir regressões e permitir a evolução segura de Login, candidatura e curadoria.

**Perfil:** Fullstack Engineer  
**Branch sugerida:** `refactor/s5-modularize-app-shell`  
**Squash merge sugerido:** `refactor(app): split screens from application shell`

**Critérios de aceite:**

- `App.jsx`/`AppShell` não contém implementação JSX de Home, detalhe, Login, Header ou Footer; ele apenas compõe módulos.
- Catálogo, detalhe, autenticação, admin e curadoria ficam em módulos independentes, com imports sem dependências circulares.
- A curadoria permanece fora de `App.jsx` e usa seu próprio adaptador de integração.
- Não há alteração intencional de layout, tokens ou comportamento de produto neste PR.
- Há testes de caracterização para Home, abertura do detalhe, Login e navegação mobile; testes de lógica existentes continuam verdes.
- `pnpm lint`, `pnpm test` e `pnpm run build` passam em PowerShell.
- Capturas desktop e mobile comprovam ausência de regressão visual e a PR cita [`design-system-communication.md`](design-system-communication.md).

**Fora de escopo:** OAuth funcional, nova regra de candidatura, redesign, mudanças de RLS e introdução de framework arquitetural.

## Regras de prevenção para novas entregas

1. Nenhuma tela nova deve ser declarada dentro de `App.jsx`.
2. Um novo fluxo de produto nasce em `features/<nome>/`, com UI, estado e integração próximos entre si.
3. UI não chama Supabase/RPC diretamente; usa módulo de integração da feature.
4. Um PR não mistura refactor estrutural com OAuth, schema/RLS, alteração visual ou regra de negócio.
5. Componentes compartilhados só entram em `shared/ui` após serem usados por ao menos duas features ou terem aprovação explícita no Design System.
6. O Tech Lead revisa dependências circulares, duplicação de componentes e cobertura de testes nos PRs que criem feature nova.

## Gatilhos para reavaliar a arquitetura

Reabrir esta decisão se ocorrer qualquer um dos cenários:

- Edge Functions/API própria passa a concentrar regras de candidatura, curadoria ou matching;
- existem dois ou mais provedores externos para a mesma capacidade;
- regras de domínio deixam de caber em validações/RPC simples;
- surgem integrações assíncronas, filas ou eventos que exigem casos de uso explícitos;
- o time passa a manter versões web e mobile com domínio compartilhado.

Nessa situação, o Tech Lead propõe uma ADR específica para introduzir camadas adicionais. Até lá, modularidade por feature e adaptadores de integração são a alternativa de menor risco.

Estrutura após ARQ-01b:

```text
src/App.jsx                 # só shell (page, sessão mock, composição)
src/shared/ui/Header.jsx
src/shared/ui/Footer.jsx
src/features/catalog/       # Home + adaptador jobs-api
src/features/jobs/          # JobDetail
src/features/auth/          # Login (OAuth fora deste PR)
src/Admin.jsx               # admin isolado
src/features/curation/      # inalterado neste PR
```

Estilos permanecem em `src/styles.css` com tokens de [`design-system-communication.md`](design-system-communication.md) (DS-06). Sem split de CSS neste PR para não alterar layout. Capturas: [`docs/assets/s5-app-shell-desktop.png`](assets/s5-app-shell-desktop.png), [`docs/assets/s5-app-shell-mobile.png`](assets/s5-app-shell-mobile.png).

## Checklist de aceite do Tech Lead

- [ ] S4 não foi bloqueado nem teve seu escopo ampliado pela refatoração.
- [ ] O PR de refactor é separado dos PRs de OAuth e de produto.
- [ ] Não houve regressão visual validada em desktop e mobile.
- [ ] Não há chamada Supabase/RPC nova dentro de componente visual.
- [ ] Testes de caracterização, lint e build estão verdes.
- [ ] A estrutura final permite criar OAuth e candidatura sem reabrir `App.jsx` para implementar a tela inteira.
