# UX-SHELL-EVENTOS-01 — landing DevFest em `/eventos`

Página estática de evento único (V1) no shell GDGJobs. Visual **DS-06**. Casca igual à Home: `.hero` pontilhado + curva DS-07 canônica; **sem** `MarketingPageShell` e **sem** `.home-divider__avatar`.

## Rotas

| URL | Acesso | Conteúdo |
|---|---|---|
| `/eventos` | Anônimo e logado (sem redirect para `/login`) | Landing DevFest Lauro de Freitas 2026 |
| Header → **Eventos** | Mesmo destino | `NavLink` em desktop e menu mobile |

Gate de onboarding (`CatalogGate`) permanece o da home: só redireciona quem ainda precisa completar o perfil.

## Quatro zonas

| Zona | Papel | Markup |
|---|---|---|
| **A** | Banner no hero pontilhado | `img.event-banner` em `.hero` > `.shell.hero-content` (`public/events/devfest-lauro-2026-banner.jpg`), `loading="eager"` + `fetchpriority="high"` |
| **B** | Card resumo (meta + CTA) | Flex desktop; empilha ≤768px. Título, data/hora, badge Presencial, local, **Realizar inscrição** |
| **C** | Descrição editorial | Copy BUILD / SECURE / SCALE + local/data/horário + site do evento |
| **D** | Organizado por | Logo GDG (`/favicon.svg`), “GDG Lauro de Freitas”, 3 CTAs `.outline` |

Conteúdo em `src/features/events/devfest-2026-content.js`. O JSX só compõe o layout.

## Links externos

| Destino | URL | Abertura |
|---|---|---|
| Inscrição Even3 | `https://www.even3.com.br/devfest-lauro-de-freitas-2026-779585/` | nova aba (`noopener noreferrer`) |
| Site do evento | `https://www.devfestlauro.com.br` | nova aba |
| Contato | `mailto:gdglaurodefreitas@gmail.com` | cliente de e-mail |
| Instagram | `https://www.instagram.com/gdglauro/` | nova aba |
| LinkedIn | `https://www.linkedin.com/in/gdg-lauro-de-freitas-a9a743313` | nova aba |

**0 network requests no mount** desta página: HTML estático, sem `useEffect`, sem Supabase, sem `jobs-api`.

## Fora de escopo

- Checkout Even3, lotes, camisas, cupons
- Programação, palestrantes, patrocinadores, FAQ
- Mapa embed (Stay22/Leaflet) e iframe
- CMS multi-evento / tabela `events` / admin de eventos
- Página `/newsletter`
- `.home-divider__avatar` (onda canônica **sim**; avatar só na Home)

O banner em `public/events/devfest-lauro-2026-banner.jpg` é a arte oficial DevFest (PO).

## Referências

- DS-06: [`design-system-communication.md`](design-system-communication.md)
- DS-07: [`design-system/section-curves.md`](design-system/section-curves.md) — junta onda inferior canônica §3.1; sem avatar
