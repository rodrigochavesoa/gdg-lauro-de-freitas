<p align="center">
  <img src="public/readme/kickoff-cover.png" alt="Kick-off de Projetos – GDG Lauro de Freitas" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/rodrigochavesoa/gdg-lauro-de-freitas/actions/workflows/ci.yml">
    <img src="https://github.com/rodrigochavesoa/gdg-lauro-de-freitas/actions/workflows/ci.yml/badge.svg" alt="CI — lint, test and build" />
  </a>
  <a href="https://www.conventionalcommits.org/pt-br/v1.0.0-beta.4/">
    <img src="https://img.shields.io/badge/Conventional%20Commits-1.0.0-FE5196?style=flat&logo=conventionalcommits&logoColor=white" alt="Conventional Commits" />
  </a>
  <br />
  <img src="https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Supabase-3FCF8E?style=flat&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white" alt="Vercel" />
  <img src="https://img.shields.io/badge/pnpm-10.30.1-F69220?style=flat&logo=pnpm&logoColor=white" alt="pnpm 10.30.1" />
  <img src="https://img.shields.io/badge/Node.js-22-339933?style=flat&logo=nodedotjs&logoColor=white" alt="Node.js 22" />
  <br />
  <img src="https://img.shields.io/badge/LGPD-por%20design-2563EB?style=flat" alt="LGPD by design" />
  <img src="https://img.shields.io/badge/GDG-Lauro%20de%20Freitas-4285F4?style=flat&logo=google&logoColor=white" alt="GDG Lauro de Freitas" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License" />
</p>

# GDGJobs — MVP de homologação

Laboratório **React/Vite + Supabase** para estudar o motor de vagas da comunidade GDG Lauro de Freitas: catálogo público, auth, curadoria e candidatura, com RLS e LGPD by design. Dados de teste; **não** é o produto oficial.

<p align="center">
  <img src="public/readme/gdgjobs-screen.png" alt="GDGJobs — catálogo de vagas em homologação" width="100%" />
</p>

## Relação com o repositório oficial

| | Comunidade | Este repositório |
|---|---|---|
| **Onde** | [**lfdev-gdg/GDGJobs**](https://github.com/lfdev-gdg/GDGJobs) | MVP Vite + Supabase (paralelo) |
| **Propósito** | Plataforma curada pela GDG (vagas nacionais e internacionais) | Homologação e aprendizado |
| **Stack** | Next.js, Tailwind, shadcn/ui | React, Vite, CSS (tokens em `src/styles.css`) |
| **Condução** | **Danielle Teixeira** — visão e entrega do GDG Jobs oficial | Estudo; **não substitui** o oficial |

Quer contribuir com o **produto da comunidade**? Comece por [lfdev-gdg/GDGJobs](https://github.com/lfdev-gdg/GDGJobs). Issues e PRs aqui são bem-vindos neste laboratório, sempre com o repo oficial como fonte de verdade do produto.

## Stack (o que roda hoje)

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + Vite 8, SPA (Home, detalhe, Admin, Login) |
| Dados e auth | Supabase (PostgreSQL, RLS, Auth) — chave publishable/anon no browser |
| Qualidade | ESLint 9, Vitest 3, GitHub Actions (`lint` / `test` / `build`) |
| Hospedagem | Vercel (`dist/` estático), após gates de privacidade |

Auth: **Supabase Auth** (Google OAuth em homologação). Sem `service_role` no frontend.

## Documentação pública

| Arquivo | Conteúdo |
|---|---|
| [**SETUP.md**](SETUP.md) | Node 22, pnpm, `.env.local`, `pnpm dev`, testes, RLS |
| [**CONTRIBUTING.md**](CONTRIBUTING.md) | Branch, PR, Conventional Commits, papéis Plan / Executor |
| [**LICENSE**](LICENSE) | MIT — GDG Lauro de Freitas, 2026 |

Documentação operacional (backlog, design system, evidências QA, regras de agentes) fica só na máquina do mantenedor, em `docs-local/` — modelo em [`docs-local.example/`](docs-local.example/).

Contato da comunidade: [gdglaurodefreitas@gmail.com](mailto:gdglaurodefreitas@gmail.com).
