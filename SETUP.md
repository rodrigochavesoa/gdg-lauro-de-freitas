# Setup — GDGJobs (MVP)

Ambiente local para clonar, instalar e rodar o laboratório. Use **PowerShell (`pwsh`)** no Windows.

## Requisitos

| Ferramenta | Versão |
|---|---|
| Node.js | **22** |
| pnpm | **10.30.1** (`packageManager` em `package.json`) |

## Variáveis de ambiente

O frontend lê o projeto **Supabase de teste** (dados fictícios ou autorizados). Nomes das variáveis estão em [`.env.example`](.env.example) — **sem valores**.

```powershell
Copy-Item .env.example .env.local
```

Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (ou o fallback `VITE_SUPABASE_ANON_KEY`) pelo canal seguro da equipe. **Nunca** commite `.env` / `.env.local` nem `service_role` no frontend.

Migrations: pasta [`supabase/migrations/`](supabase/migrations/). Aplique-as no projeto de teste pelo CLI ou SQL Editor do Supabase **antes** de validar o catálogo.

## Comandos

```powershell
pnpm install
pnpm dev          # http://127.0.0.1:5173
pnpm lint
pnpm test
pnpm run build
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
