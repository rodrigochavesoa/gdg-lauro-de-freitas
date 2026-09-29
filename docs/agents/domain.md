# Domain docs — GDGJobs

Como agentes devem carregar contexto de **produto e código** (não confundir com doc operacional do squad em `docs-local/`).

## Layout

| Camada | Onde ler | Conteúdo |
|--------|----------|----------|
| Onboarding público | `README.md`, `ABOUT.md`, `SETUP.md`, `CONTRIBUTING.md` | Produto, jornadas, setup, homologação vs produção e Git/PR |
| Código | `src/` — `features/`, `lib/`, `components/`, `routes/` | Comportamento real; preferir ler módulo da feature antes de inferir |
| Dados / auth | `supabase/migrations/`, `scripts/check-rls.mjs` | RLS, RPC, políticas |
| Contratos de leitura | `docs/tech/DATA-CONTRACTS.md`, `src/lib/data-contracts/` | Select por superfície e DTO; listas sem coluna de detalhe |
| Cache em memória | `docs/tech/CACHE-POLICY.md`, `src/lib/client-cache/` | TTL, chave e invalidação; autorização não depende do mapa |
| Testes | `src/**/*.test.js`, `pnpm test` | Contratos e regressões |
| Modelos operacionais (sem dados) | `docs-local.example/` | Templates ClickUp, QA, credenciais — **não** sprint viva |
| Operação do squad | `docs-local/` | Backlog, ONE-LINERs, design system interno, assets QA — gitignored |

Não há `CONTEXT.md` na raiz. Para decisões arquiteturais versionadas, consultar `docs/adr/`; decisões operacionais do squad continuam em `docs-local/`.

## Regras para agentes

1. **Fronteira público vs local** — antes de criar arquivos, seguir `CONTRIBUTING.md` e rule `public-docs-boundary`: operação → `docs-local/`; só versionar o que é produto ou template genérico.
2. **Homologação** — MVP de laboratório; Preview Vercel = Supabase homolog; Production = projeto separado sem seed fictício (`SETUP.md`).
3. **Stack congelada** — React 19 + Vite SPA, CSS tokens em `src/styles.css`; sem Next/Tailwind neste repo (`ABOUT.md` § Stack).
4. **Spec de entrega** — resolver via `docs/agents/issue-tracker.md` (ClickUp ID no PR + handoff local).

## Glossário rápido

- **GDGJobs** — catálogo de vagas, auth, candidatura, curadoria/admin, ingest.
- **ONE-LINER** — brief operacional para Executor (em `docs-local/`).
- **Plan / Executor / Visual QA** — papéis em `docs-local/AGENTS.md` (cópia local de `docs-local.example/AGENTS.md.example`).
