# Setup — GDGJobs (MVP)

Ambiente local para clonar, instalar e rodar o laboratório. Use **PowerShell (`pwsh`)** no Windows.

## Requisitos

| Ferramenta | Versão |
|---|---|
| Node.js | **22** |
| pnpm | **10.30.1** (`packageManager` em `package.json`) |

## Variáveis de ambiente

O frontend lê **um** projeto Supabase por build. Nomes das variáveis estão em [`.env.example`](.env.example) — **sem valores**.

| Destino | Projeto Supabase | Seed fictício |
|---|---|---|
| `pnpm dev` / `.env.local` | Homologação | Sim |
| Vercel **Preview** | Homologação | Sim |
| Vercel **Production** (`*.vercel.app`) | Produção (projeto separado) | **Não** |

```powershell
Copy-Item .env.example .env.local
```

Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (ou o fallback `VITE_SUPABASE_ANON_KEY`) pelo canal seguro da equipe. **Nunca** commite `.env` / `.env.local` nem `service_role` no frontend, no Git ou nas env vars públicas da Vercel.

Migrations: pasta [`supabase/migrations/`](supabase/migrations/). Homologação aplica a cadeia completa (inclui seed). Produção aplica só o que `pnpm migrations:prod` listar — **sem** `seed_fictitious_catalog`.

## OAuth (Google via Supabase Auth)

Redirect URLs permitidas neste recorte (sem domínio customizado — C-05):

- `http://127.0.0.1:5173/**` — local
- `https://*.vercel.app/**` — Preview e Production no Hobby

Configure as mesmas origens no provedor Google e em Authentication → URL Configuration **de cada** projeto Supabase (homologação e produção). Não aponte Production para o projeto de homologação.

## Rollback (Vercel Hobby)

1. Dashboard Vercel → Deployments → abrir o deploy **Production anterior** → Promote to Production.
2. Não reaplicar seed no banco de produção.
3. Confirmar que Production continua com a URL do projeto Supabase de produção.

Publicar Production exige aceite do PO. Este repositório não promove Production automaticamente.

## Caminho de backup (C-06, não fecha nesta história)

No Free/Hobby: backups do dashboard Supabase no projeto de **produção** (não copiar dump de homologação). PITR e plano pago só com autorização do PO. Simulação de restore é MVP-007.

## Comandos

```powershell
pnpm install
pnpm dev          # http://127.0.0.1:5173
pnpm lint
pnpm test
pnpm run build
pnpm check:bundle  # falha se dist/ tiver service_role / sb_secret / chave privada
pnpm migrations:prod
```

RLS e papéis de homologação (opcional, fora do CI):

```powershell
# Requer .env.local + contas em docs-local/*-test-user.md (gitignored)
# e, para o cenário F-019, SUPABASE_SERVICE_ROLE_KEY só no .env.local
pnpm test:rls
```

Modelo de credenciais (sem senhas reais): copie [`docs-local.example/`](docs-local.example/) para `docs-local/`. Documentação operacional do time (backlog, DS, QA) também fica em `docs-local/` — ver o README dessa pasta exemplo.

## O que este setup não inclui

Segredos, evidências Visual QA e governança de agentes **não** vão no clone público. Mantenedores: `pwsh scripts/migrate-docs-to-local.ps1` se ainda tiverem `docs/` no histórico local.
