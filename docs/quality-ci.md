# Qualidade local e CI — S1-01

**Status:** aprovada pelo Tech Lead em 2026-08-15. Evidência local reexecutada em PowerShell: `pnpm lint`, 7 testes Vitest e `pnpm run build` passaram.

Validação do frontend Vite/React. Execute os comandos em **PowerShell (`pwsh`)**, sem WSL.

## Pré-requisitos

- Node.js 22
- pnpm 10.30.1

## Comandos

```powershell
pnpm install
pnpm lint
pnpm test
pnpm run build
```

| Script | Função |
|---|---|
| `pnpm lint` | ESLint no frontend (`js`/`jsx`) |
| `pnpm test` | Vitest em modo CI (`vitest run`) |
| `pnpm test:watch` | Vitest em modo watch |
| `pnpm run build` | Build de produção Vite |

## O que o CI faz

O workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) roda em `push` e `pull_request`:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm run build`

Se lint, teste ou build falhar, o check fica vermelho e o PR não atende a Definition of Done do Sprint 1.

## Dependência humana

O workflow só valida PRs reais depois que o repositório Git remoto existir e o GitHub Actions estiver autorizado no projeto.

## Fora de escopo

Não conecta Supabase, OAuth, Gemini nem faz deploy.
