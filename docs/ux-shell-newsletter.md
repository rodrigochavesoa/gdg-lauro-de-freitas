# UX-SHELL-NEWSLETTER-01 — placeholder `/newsletter`

Página estática V1 no **mesmo shell da Home**: hero pontilhado, curva DS-07 canônica (sem avatar), conteúdo em `--color-surface`, CTA comunidade quando anônimo. Visual **DS-06**. Sem Resend e sem captura de e-mail (C-05 / Sprint 7).

## Rotas

| URL | Acesso | Conteúdo |
|---|---|---|
| `/newsletter` | Anônimo e logado (sem redirect para `/login`) | Placeholder GDG Jobs Letter |
| Header → **Newsletter** | Mesmo destino | `NavLink` desktop e menu mobile |

Gate de onboarding (`CatalogGate`) igual à home.

## Contrato visual (Home)

| Peça | Implementação |
|---|---|
| Hero pontilhado | `<section class="hero">` — tokens globais (`surface-subtle` + malha 16px) |
| Junta DS-07 | `.home-divider` + path canônico §3.1; **sem** `.home-divider__avatar` |
| Miolo | `.shell.newsletter-layout` — padding-top 52px / 36px mobile (espelha `.jobs-layout`) |
| Header | `.hero` ativa `body:has(.hero) .topbar { border-bottom: none }` |
| Footer | Global `App.jsx` — inalterado |
| CTA | `.cta` só quando `logged === false` |

## Quatro zonas

| Zona | Papel |
|---|---|
| **A** | Hero: eyebrow + H1 **GDG Jobs Letter** + lead |
| **B** | **Inscrever-se** — nome + e-mail desabilitados em linha no desktop (empilha no mobile), CTA inerte “Em breve”, nota Sprint 7 (C-05) |
| **C** | **Edições recentes** — 4 cards estáticos (`newsletter-content.js`); CTA inerte “Ler edição” no amarelo GDG (`--color-gdg-yellow`) com texto branco |
| **D** | Faixa `.cta` (anon) — “Criar perfil gratuito” → `/login` |

**0 network requests no mount:** HTML estático, sem `useEffect`, sem Supabase, sem `jobs-api`.

## Fora de escopo

- Resend, lista real, LGPD/consentimento (C-05)
- Página `/eventos`
- OAuth, admin, migrations
- `.home-divider__avatar`

## Referências

- DS-06: [`design-system-communication.md`](design-system-communication.md)
- DS-07: [`design-system/section-curves.md`](design-system/section-curves.md) — onda inferior §3.1
- Shell: [`src/features/catalog/Home.jsx`](../src/features/catalog/Home.jsx)
