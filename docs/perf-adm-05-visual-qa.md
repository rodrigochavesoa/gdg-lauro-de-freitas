# PERF-ADM-05 — Homolog Visual QA (fila de curadoria no remount)

**Data:** 2026-09-08 · **Branch:** `fix/perf-adm-05-curation-queue-remount` @ `1f92047`  
**URL:** `http://127.0.0.1:5173` (Vite `--host 127.0.0.1`; `localhost:5173` do terminal do usuário estava down; IPv6-only recusa Playwright)  
**Ferramenta:** Playwright 1280×720 / 390×844 (chrome-devtools-mcp **offline**; Playwriter não usado nesta sessão)  
**Staff:** `docs-local/admin-test-user.md` (`admin`) · ThemeToggle **Claro** / **Escuro** (`html[data-theme]`)  
**Sem push** deste agente.

Evidências: [`docs/assets/perf-adm-05/`](assets/perf-adm-05/) · [`audit-log.json`](assets/perf-adm-05/audit-log.json) · [`measure-admin-nav.log`](assets/perf-adm-05/measure-admin-nav.log)

## Resumo

Staff logado em `/admin` vê abas no 1º paint, sem `"Carregando área administrativa…"`. A primeira visita à aba **Curadoria** mostra o gate `"Carregando fila de curadoria…"` (~1,1 s) — **cold miss aceitável**. Remount Header **Vagas** → **Área admin** → **Curadoria** (TTL &lt;30 s) pinta **Fila de revisão** + **Vagas pending** de imediato, **0 amostras** do gate em sampling rAF (~800 ms) e **0/5** no `pnpm qa:admin-nav`. Alternar **Curadoria ↔ Publicar vaga** não reexibe o gate; a fila permanece. Light e dark consistentes; mobile 390×844 com abas 44 px.

Contraste before (script / doc da história): T3-curation **963 ms / gate 5/5** → esta homolog **463 ms / gate 0/5**.

## Achados

| ID | Sev | QA ref | Evidência | Correção sugerida |
|---|---|---|---|---|
| — | — | — | Nenhum P0/P1 nesta rodada | — |

**Notas de método (não são bugs):**

- Gate no **cold miss** (1ª visita Curadoria na sessão) é critério aceito: 69/150 amostras entre 106–1218 ms; some após o fetch.
- Remount ainda dispara `rest/v1` (`companies`, `jobs`, e SWR `jobs_needing_moderation` / `job_curation_reviews`) — refresh em background documentado em [`s4-curation-ui.md`](s4-curation-ui.md); o gate **não** reaparece.
- Form **Publicar vaga** permanece no DOM com `hidden` (PERF-ADM-04); `h1` “Publicar nova vaga” pode existir ao mesmo tempo que a fila.

## Temas

- Light: OK — tabs DS-06, fila e card da vaga pending legíveis; ThemeToggle Claro (`data-theme="light"`)
- Dark: OK — ThemeToggle Escuro; fila e card com tokens escuros; sem gate no remount

## Console / rede

- Console errors (path `/admin` + remount + abas + mobile): **nenhum**
- Cold Curadoria: fetch fila (`jobs`, `jobs_needing_moderation`, `job_curation_reviews`)
- Remount: `companies` + `jobs` + SWR da fila; **sem** spinner admin

## Checklist ONE-LINER

| Critério | Resultado | Evidência |
|---|---|---|
| Staff → `/admin` → Curadoria → fila visível | **Pass** | [`curation-cold-ready-light-1280x720.png`](assets/perf-adm-05/curation-cold-ready-light-1280x720.png) |
| Remount P0: Vagas → Área admin → Curadoria **sem** flash prolongado do gate | **Pass** | gate rAF **0 hits**; [`curation-remount-immediate-light-1280x720.png`](assets/perf-adm-05/curation-remount-immediate-light-1280x720.png) |
| QA-ADM-08: Curadoria ↔ Publicar vaga sem gate; fila permanece | **Pass** | tab-switch gate **0 hits**; [`curation-after-tab-switch-light-1280x720.png`](assets/perf-adm-05/curation-after-tab-switch-light-1280x720.png) |
| PERF-ADM-03: boot `/admin` com snapshot — tabs no 1º paint, sem `"Carregando área administrativa…"` | **Pass** | tabs **128 ms** no remount; spinner **0/5**; [`admin-boot-publish-light-1280x720.png`](assets/perf-adm-05/admin-boot-publish-light-1280x720.png) |
| Light + dark (ThemeToggle); desktop ≥1280 | **Pass** | [`curation-remount-dark-1280x720.png`](assets/perf-adm-05/curation-remount-dark-1280x720.png) |
| Mobile spot QA-ADM-09: abas legíveis | **Pass** | tabs **155×44**; [`curation-mobile-light-390x844.png`](assets/perf-adm-05/curation-mobile-light-390x844.png) · dark [`curation-mobile-dark-390x844.png`](assets/perf-adm-05/curation-mobile-dark-390x844.png) |
| Console sem erros novos | **Pass** | `audit-log.json` `consoleErrors: []` |

## `pnpm qa:admin-nav` (T3-curation)

| Marco | Before (doc #59) | Homolog 2026-09-08 |
|---|---|---|
| T1 `.admin-tabs` | ~84 ms | mediana **88** ms |
| Spinner admin | 0/5 | **0/5** |
| T3-curation mediana | 963 ms → 441 ms | **463** ms |
| Gate `"Carregando fila de curadoria…"` | 5/5 → 0/5 | **0/5** |

Log: [`measure-admin-nav.log`](assets/perf-adm-05/measure-admin-nav.log).

## Recomendação Plan

**APROVADO homolog visual** — PERF-ADM-05 atende o gate de remount (contraste 5/5 → 0/5). Aceite PO **QA-ADM-07..09**. Sem push deste agente.

Script de evidência: [`docs/assets/perf-adm-05/_audit.mjs`](assets/perf-adm-05/_audit.mjs).
