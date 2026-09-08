# UX-PERF-02–04 — Homolog Visual QA

**Data:** 2026-09-08 · **Branch:** `fix/ux-perf-02-04-job-detail-stack` @ `58770f4`  
**URL:** `http://localhost:5173` (IPv6) — `http://127.0.0.1:5173` recusou conexão neste host  
**Ferramenta:** Playwright 1280×720 (chrome-devtools-mcp **offline**; Playwriter CLI disponível, evidências via script repetível)  
**Tema:** ThemeToggle **Claro** / **Escuro** (`html[data-theme]`)

Evidências: [`docs/assets/ux-perf-02-04/`](assets/ux-perf-02-04/) · log [`audit-log.json`](assets/ux-perf-02-04/audit-log.json)

## Resumo

Homolog anon desktop confirma o stack 03/04 no detalhe e **não regride PERF-05** na home. Clique no card pinta título/meta na hora (`aria-busy` + 3 blocos skeleton de description/requirements); cold `/jobs/:id` mostra `JobDetailSkeleton` DS-06, sem flash `"Carregando vaga…"`. Login → **Vagas** (dwell ~900 ms) lista 4 cards sem `.job-card--skeleton` animado. 2ª visita SPA (cache quente) permanece com 4 cards e 0 skeletons. Light e dark consistentes; CTA apply anon redireciona a `/login`; chrome pontilhado UX-JOBS-01 presente no `.detail-page`.

## Achados

| ID | Sev | QA ref | Evidência | Correção sugerida |
|---|---|---|---|---|
| — | — | — | Nenhum P0/P1 nesta rodada | — |

**Nota de método (não é bug):** `page.goto('/login')` é reload completo — zera o cache in-memory. A 2ª visita **SPA** (link Header) é o critério de cache quente: 4 cards / 0 skeletons ([`home-warm-spa-light-1280x720.png`](assets/ux-perf-02-04/home-warm-spa-light-1280x720.png)).

## Temas

- Light: OK — hero DS-06, divider DS-07, cards e detalhe legíveis
- Dark: OK — `data-theme="dark"` via ThemeToggle Escuro; detalhe e home com tokens escuros e campo pontilhado

## Console / rede

- Console errors: **nenhum** no audit
- From-home: request **heavy** (não full) após delay de teste
- Cold: `JobDetailSkeleton` visível; depois conteúdo completo
- `pnpm qa:job-detail` (opcional) — ver tabela below / [`ux-perf-02-job-detail-load.md`](ux-perf-02-job-detail-load.md)

## Checklist ONE-LINER

| Critério | Resultado | Evidência |
|---|---|---|
| `/` → card → detalhe sem `"Carregando vaga…"`; título/meta imediatos; description depois | **Pass** | `from-home-partial` + `from-home-ready`; h1 imediato; 3× `.detail-skeleton-block`; description após heavy |
| Cold `goto /jobs/:id` → `JobDetailSkeleton` depois conteúdo | **Pass** | `cold-skeleton-light`; `sawSkeleton: true`; loading text 0 |
| `/login` → Vagas → scroll: sem 4× skeleton **animado** (PERF-05) | **Pass** | `homeAnimatedCount: 0`; 4 cards; `login-to-home-light` / `dark` |
| 2ª visita `/` cache quente: lista sem skeleton | **Pass** | SPA: 4 cards, `staticHome: 0`, `animatedHome: 0` |
| Light + dark, desktop ≥1280 | **Pass** | ThemeToggle Claro/Escuro |
| CTA apply / voltar / chrome UX-JOBS-01 | **Pass** | apply → `/login`; Voltar presente; `.detail-page` `radial-gradient` pontilhado |

## `pnpm qa:job-detail` (after vs baseline PERF-02)

| Cenário | Baseline (02) | Homolog stack 03/04 | `"Carregando vaga…"` |
|---|---|---|---|
| Cold shell / ready | mediana **525** ms | shell **236** ms · full **961** ms | 5/5 → **0/5** |
| From-home useful | mediana **384** ms (gate ready) | h1 **110** ms · full **873** ms | 5/5 → **0/5** |
| Select kinds | full sempre | from-home **heavy×5**; cold **full×5** + list prefetch | — |

## Recomendação Plan

**APROVADO homolog visual** — PERF-05 preservado; 03/04 visíveis no browser. Aceite DS-05 humano/PO. Sem push deste agente.
