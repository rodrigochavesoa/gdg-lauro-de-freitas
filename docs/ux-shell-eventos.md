# UX-SHELL-EVENTOS — índice e landings estáticas

Páginas estáticas no shell GDGJobs. Visual **DS-06**. Casca igual à Home: `.hero` pontilhado + curva DS-07 canônica; **sem** `MarketingPageShell` e **sem** `.home-divider__avatar`.

**Breaking (UX-SHELL-EVENTOS-02):** `/eventos` deixou de ser a landing do DevFest. Quem tinha bookmark da landing única deve usar `/eventos/devfest-lauro-de-freitas-2026`.

## Rotas

| URL | Acesso | Conteúdo |
|---|---|---|
| `/eventos` | Anônimo e logado (sem redirect para `/login`) | Índice: H1 **Eventos** + 2 cards |
| `/eventos/devfest-lauro-de-freitas-2026` | Idem | Landing DevFest (4 zonas, conteúdo de `devfest-2026-content.js`) |
| `/eventos/devopsdays-salvador-2026` | Idem | Landing DevOpsDays Salvador 2026 |
| `/eventos/:slug` desconhecido | — | Redirect para `/eventos` |
| Header → **Eventos** | Índice | `NavLink` desktop e menu mobile |

Gate de onboarding (`CatalogGate`) permanece o da home.

## Índice `/eventos`

Hero curto (eyebrow + H1 + lead) → curva DS-07 → grid de cards (thumb 16:9 com `object-fit: contain`, fundo `--color-surface` e **sem** borda interna, título, data, local, **Ver evento**). **Sem** banner gigante. O índice **não** tem botão voltar.

## Quatro zonas (detalhe)

O detalhe inclui **Voltar para eventos** (`button.back`, paridade JobDetail) imediatamente acima das zonas B–D (depois da curva DS-07); o clique vai para `/eventos` (não `history.back()`).

| Zona | DevFest | DevOpsDays |
|---|---|---|
| **A** | Banner 1280×720, `object-fit: cover` | Banner vertical 1170×5000, `event-banner--portrait` (`contain` + `max-height: min(420px, 50vh)`) |
| **B** | Resumo + **Realizar inscrição** (Even3) | Resumo + **Garantir ingresso** (pretix) |
| **C** | intro + pillars BUILD/SECURE/SCALE + facts | `intro[]` + `facts[]` (sem pillars) |
| **D** | GDG Lauro de Freitas | DevOpsDays Salvador |

JSX compartilhado: `EventLanding.jsx`. Catálogo: `events-catalog.js`.

## Links externos — DevFest

| Destino | URL | Abertura |
|---|---|---|
| Inscrição Even3 | `https://www.even3.com.br/devfest-lauro-de-freitas-2026-779585/` | nova aba (`noopener noreferrer`) |
| Site do evento | `https://www.devfestlauro.com.br` | nova aba |
| Contato | `mailto:gdglaurodefreitas@gmail.com` | cliente de e-mail |
| Instagram | `https://www.instagram.com/gdglauro/` | nova aba |
| LinkedIn | `https://www.linkedin.com/in/gdg-lauro-de-freitas-a9a743313` | nova aba |

## Links externos — DevOpsDays Salvador 2026

| Destino | URL | Abertura |
|---|---|---|
| Ingressos pretix | `https://tickets.devopsdays.org/devopsdays-salvador/2026/` | nova aba |
| Site do evento | `https://devopsdays.org/events/2026-salvador/welcome/` | nova aba |
| Contato | `mailto:salvador@devopsdays.org` | cliente de e-mail |
| Instagram | `https://www.instagram.com/devopsdayssalvador/` | nova aba |
| LinkedIn | `https://www.linkedin.com/company/devopsdayssalvador/` | nova aba |

**0 network requests no mount** do índice e das landings: HTML estático, sem `useEffect`, sem Supabase, sem `jobs-api`.

## Fora de escopo

- Checkout Even3/pretix, lotes, camisas, cupons
- Programação, palestrantes, patrocinadores, FAQ
- Mapa embed e iframe
- CMS / tabela `events` / admin de eventos
- Página `/newsletter`
- `.home-divider__avatar` (onda canônica **sim**; avatar só na Home)

Banner DevFest: `public/events/1788886782636.png`. Banner DevOpsDays: `public/events/d570782909129eef51789263259b10a0.1170x5000.png` (PO).

## Referências

- DS-06: [`design-system-communication.md`](design-system-communication.md)
- DS-07: [`design-system/section-curves.md`](design-system/section-curves.md) — junta onda inferior canônica §3.1; sem avatar
