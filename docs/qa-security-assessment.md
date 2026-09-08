# QA-SEC-01 — Assessment de homologação

**Status:** QA-SEC-01b concluído · **QA-SEC-01a manual browser concluído** (2026-09-08)  
**Ambiente:** GDG-JOBS-SENAI (`pcdfxnfhgdmzmcmlhxuv`) · app local `http://localhost:5173` · branch evidência `docs/qa-sec-01a-visual-audit`  
**Setup:** SETUP-HOMOLOG-01 **ok** — 6 papéis; `docs-local/` + baseline automatizado verde.  
**Ferramenta Visual QA:** **Playwriter** 0.5.0 (extensão Chrome + sessão headless fallback para screenshots estáveis). chrome-devtools-mcp **não** conectado nesta sessão.  
**Revalidação automatizada prévia:** `main` @ `5684dd5` · 80 Vitest · `test:rls` 1–12.

## Resumo executivo

| Métrica | Valor |
|---|---|
| Casos P0 (automatizado + manual 01a) | 18 auto + 9 manuais browser nesta rodada |
| Passou (automatizado) | 18 |
| Passou (manual browser 01a) | 9 (QA-ANON-07/08/10, QA-CAND-01/10, QA-ADM-07/08/09, QA-SEC-02 spot) |
| Falhou | 0 |
| Bloqueado (env/credencial) | 0 |
| Findings abertos (Critical/High) | 0 |
| Findings Info novos | 0 (F-018 resolvido — copy admin login) |
| Findings UX resolvidos (#37–#45) | 3 (F-015, F-016, F-017) |

## Baseline automatizado

| Comando | Resultado | Log / notas |
|---|---|---|
| `pnpm lint` | **pass** | `eslint .` — exit 0 |
| `pnpm test` | **pass** (80/80) | Vitest 3.2.4; `Test Files  17 passed (17)`; exit 0 |
| `pnpm run build` | **pass** | Vite 8.2.1; exit 0 |
| `pnpm test:rls` | **pass** | Cenários **1–12** executados; **0** FALHA (última execução 2026-09-07) |

## QA-SEC-01a — Relatório Visual QA (2026-09-08)

### Resumo

Homolog visual P0 em `http://localhost:5173` (Vite na **5173**; IPv6 `localhost` — `127.0.0.1` recusou conexão). Ordem de sessão respeitada: anon → candidato Google OAuth (humano confirmou) → sign out → admin e-mail/senha (humano confirmou). Light/Dark via ThemeToggle (`html[data-theme]`). Catálogo, gates, OAuth + persistência, dashboard candidato com withdraw, nav admin unificada, fila Curadoria e form mobile utilizável — **sem regressão crítica** pós #37–#45.

### Achados

| ID | Sev | QA ref | Evidência | Correção sugerida |
|---|---|---|---|---|
| F-018 | Info | QA-ADM-01 / copy | `/admin` login ainda diz *“Google OAuth fica para o Sprint 5”* enquanto candidato já autentica via Google em `/login` | Atualizar microcopy em `Admin.jsx` (login staff) — **resolvido** neste PR |

### Temas

- **Light:** OK — Header, hero Home, curvas DS-07, CTA `.cta`, job detail, login, admin tabs/form, contraste legível.
- **Dark:** OK — Home + candidaturas + admin amostrados; tokens `data-theme="dark"` aplicados; ThemeToggle Claro/Escuro/Sistema funcional.

### Console / rede

- Erros JS críticos: **nenhum** observado nas sessões Playwriter (anon headless + candidato/admin Chrome).
- `service_role` no DOM/HTML: **ausente** (QA-SEC-02 spot).
- Supabase env: catálogo carregou 4 vagas approved; OAuth redirecionou para Google → retorno `localhost:5173` com sessão.

### Recomendação Plan

- **APROVADO** homolog visual QA-SEC-01a (P0 amostrado).
- **F-018** resolvido (microcopy staff em `/admin`). Sem bloqueio de merge visual.

### Evidências (15)

Pasta [`docs/assets/qa-sec-01a/`](assets/qa-sec-01a/).

| Arquivo | Cobertura |
|---|---|
| `QA-ANON-home-light-1280x720.png` / `…-dark-…` | Home catálogo + CTA + DS-07 |
| `QA-ANON-07-job-light-1280x720.png` | Detalhe vaga approved |
| `QA-ANON-07-apply-login-light-1280x720.png` | Apply → `/login` |
| `QA-ANON-08-admin-gate-light-1280x720.png` | `/admin` gate (form staff) |
| `QA-ANON-10-login-light-1280x720.png` | CTA Criar perfil → login Google |
| `QA-CAND-01-home-logged-light-1280x720.png` | Header logado pós-OAuth |
| `QA-CAND-10-apps-light/dark-1280x720.png` + `…-light-390x844.png` | Dashboard + withdraw |
| `QA-ADM-07-admin-light/dark-1280x720.png` | Tabs unificadas; sem `.admin-user` duplicado |
| `QA-ADM-08-curadoria-light-1280x720.png` | Fila Curadoria monta |
| `QA-ADM-09-admin/publicar-light-390x844.png` | Mobile tabs + form |

## Findings — resolvidos (Admin UX / perf #37–#45)

| ID | QA ref | Severidade | Título | Descrição | Correção | PR |
|---|---|---|---|---|---|---|
| F-015 | QA-ADM-07 | Medium | Nav admin assimétrica (sidebar vs tabs) | Desktop sidebar + mobile tabs duplicavam destinos | Tabs unificadas; sidebar removida | #37, #39 |
| F-016 | QA-ADM-07 | Low | Card perfil duplicado na fila | `.admin-user` repetia info já no Header | Removido card/sidebar | #39 |
| F-017 | QA-ADM-03 | Low | Lista vagas admin desorganizada | pending/approved misturados | Seções separadas; form acima | #40 |
| F-018 | QA-ADM-01 | Info | Copy login admin desatualizado | Texto Sprint 5 no gate `/admin` com OAuth candidato já ativo | Microcopy: staff e-mail/senha; candidatos em Login | este PR |

## Findings — abertos

Nenhum finding aberto.

**Severidade:** Critical · High · Medium · Low · Info

## Matriz P0 — resultados (baseline + QA-SEC-01a)

Referência: [`qa-test-plan-homolog.md`](qa-test-plan-homolog.md).

### Anon

| ID | Resultado | Evidência |
|---|---|---|
| QA-ANON-01 | **Pass (RLS 1)** | `test:rls` — anon só `approved`; pending filtrado |
| QA-ANON-03 | **Pass (RLS 1)** | Anon não filtra pending |
| QA-ANON-06 | **Pass (RLS 1)** | Anon não lê pareceres / RPC curadoria |
| QA-ANON-07 | **Pass (manual 01a)** | Apply “Candidatar-se com 1 clique” → `/login` · `docs/assets/qa-sec-01a/QA-ANON-07-*.png` |
| QA-ANON-08 | **Pass (manual 01a)** | `/admin` → form staff (sem área logada); `/minhas-candidaturas` → `/login` · `QA-ANON-08-admin-gate-*.png` |
| QA-ANON-10 | **Pass (manual 01a)** | CTA “Criar perfil gratuito” → `/login` (Google CTA) · `QA-ANON-10-login-*.png`; smoke Vitest #45 |

### Candidato

| ID | Resultado | Evidência |
|---|---|---|
| QA-CAND-01 | **Pass (manual 01a)** | Google OAuth (humano); Header VC + Sair; refresh persiste; sign out → `/login` · `QA-CAND-01-home-logged-*.png` |
| QA-CAND-02 | **Pass smoke (01a)** | Gate D-01 **não** disparou (perfil já completo); sem redirect `/onboarding` |
| QA-CAND-03 | **Pass (RLS 10)** | apply + snapshot D-08 |
| QA-CAND-06 | **Pass (RLS 12)** | withdraw submitted/reviewing |
| QA-CAND-10 | **Pass (manual 01a)** | Lista 2× `Enviada` + “Retirar candidatura” (×2); light/dark + mobile · `QA-CAND-10-*.png` |
| QA-CAND-11 | **Pass (RLS 2, 11)** | Sem INSERT apply direto; isolamento candidato |

### Curador / Moderador / Admin

| ID | Resultado | Evidência |
|---|---|---|
| QA-CUR-05 | **Pass (RLS 5)** | Quórum 2× approve → `approved` |
| QA-MOD-01 | **Pass (RLS 7)** | Moderador resolve empate |
| QA-ADM-02 | **Pass (RLS admin)** | Admin cadastra `pending`; visitante não vê |
| QA-ADM-07 | **Pass (manual 01a)** | Tabs Curadoria/Publicar unificadas; remount Vagas→Admin **sem** spinner “Carregando área administrativa…”; `.admin-user` = 0 · `QA-ADM-07-*.png` |
| QA-ADM-08 | **Pass (manual 01a)** | Curadoria monta fila pending; toggle Curadoria↔Publicar ok · `QA-ADM-08-curadoria-*.png` |
| QA-ADM-09 | **Pass (manual 01a)** | 390×844: tabs + form Publicar (9 inputs) utilizáveis · `QA-ADM-09-*.png` |

### Segurança transversal (baseline)

| ID | Resultado | Evidência |
|---|---|---|
| QA-SEC-03 | **Pass (RLS 10–12)** | Candidato só apply/withdraw via RPC |
| QA-SEC-01 | **Pendente** | Confirmar no commit doc-only: sem `.env` staged |
| QA-SEC-02 | **Pass (spot 01a)** | Sem `service_role` no HTML/DOM das rotas amostradas |
| QA-SEC-07 | **Pass (doc)** | Seis controles LGPD ainda pendentes — produção bloqueada |

## Backlog gerado

| Finding | Item backlog / PR | Prioridade |
|---|---|---|
| F-015 | #37, #39 | — resolvido |
| F-016 | #39 | — resolvido |
| F-017 | #40 | — resolvido |
| F-018 | Copy login admin (staff vs candidato) | — resolvido (este PR) |
| PERF-CAT-02 | Cold load home &lt;900 ms | P2 opcional |

## Próximo passo

1. **Plan:** revisar este assessment + screenshots → **Sim** para squash merge `docs(qa): record QA-SEC-01a visual homolog results` (sem push até Sim).
2. **C-05:** fechar Resend para Sprint 7 (paralelo).

## Aprovação

| Papel | Nome | Data | Homologação OK para próximo sprint? |
|---|---|---|---|
| Frontend Visual QA | QA-SEC-01a browser | 2026-09-08 | ☐ recomendado **Sim** (aguarda Plan) |
| Plan TL | closeout docs #37–#45 + 01a | 2026-09-08 | ☐ Sim ☐ Não |
| PO | | | |
