# QA-SEC-01 — Assessment de homologação

**Status:** QA-SEC-01b concluído · QA-SEC-01a manual browser **pendente** (incl. QA-ADM-07..09, QA-ANON-10)  
**Ambiente:** GDG-JOBS-SENAI (`pcdfxnfhgdmzmcmlhxuv`) · **`main` @ `5684dd5`** · **Última revalidação automatizada:** 2026-09-08  
**Setup:** SETUP-HOMOLOG-01 **ok** — 6 papéis já existiam; `docs-local/` + `test:rls` 1–12 verdes.  
**Revalidação:** Baseline reexecutado pós #37–#45; 80 testes Vitest verdes.

## Resumo executivo

| Métrica | Valor |
|---|---|
| Casos P0 executados | 18 / ~40 (baseline RLS + Vitest; manual browser pendente) |
| Passou (automatizado) | 18 |
| Falhou | 0 |
| Bloqueado (env/credencial) | 0 |
| Findings abertos (Critical/High) | 0 |
| Findings UX resolvidos (#37–#45) | 3 (F-015, F-016, F-017) |

## Baseline automatizado

| Comando | Resultado | Log / notas |
|---|---|---|
| `pnpm lint` | **pass** | `eslint .` — exit 0 |
| `pnpm test` | **pass** (80/80) | Vitest 3.2.4; `Test Files  17 passed (17)`; exit 0 |
| `pnpm run build` | **pass** | Vite 8.2.1; exit 0 |
| `pnpm test:rls` | **pass** | Cenários **1–12** executados; **0** FALHA (última execução 2026-09-07) |

## Findings — resolvidos (Admin UX / perf #37–#45)

| ID | QA ref | Severidade | Título | Descrição | Correção | PR |
|---|---|---|---|---|---|---|
| F-015 | QA-ADM-07 | Medium | Nav admin assimétrica (sidebar vs tabs) | Desktop sidebar + mobile tabs duplicavam destinos | Tabs unificadas; sidebar removida | #37, #39 |
| F-016 | QA-ADM-07 | Low | Card perfil duplicado na fila | `.admin-user` repetia info já no Header | Removido card/sidebar | #39 |
| F-017 | QA-ADM-03 | Low | Lista vagas admin desorganizada | pending/approved misturados | Seções separadas; form acima | #40 |

## Findings — abertos

| ID | QA ref | Severidade | Título | Descrição | Reprodução | Correção sugerida | Owner | Sprint/PR |
|---|---|---|---|---|---|---|---|---|
| — | — | — | *(nenhum Critical/High)* | | | | | |

**Severidade:** Critical · High · Medium · Low · Info

## Matriz P0 — resultados (baseline + pendências manuais)

Referência: [`qa-test-plan-homolog.md`](qa-test-plan-homolog.md).

### Anon

| ID | Resultado | Evidência |
|---|---|---|
| QA-ANON-01 | **Pass (RLS 1)** | `test:rls` — anon só `approved`; pending filtrado |
| QA-ANON-03 | **Pass (RLS 1)** | Anon não filtra pending |
| QA-ANON-06 | **Pass (RLS 1)** | Anon não lê pareceres / RPC curadoria |
| QA-ANON-07 | **Pendente manual** | Browser: CTA apply → `/login` |
| QA-ANON-08 | **Pendente manual** | Browser: `/admin`, `/minhas-candidaturas` |
| QA-ANON-10 | **Pass (smoke)** | `App.smoke.test.jsx` — CTA → Login; oculto se logado (#45). **Pendente manual** homolog |

### Candidato

| ID | Resultado | Evidência |
|---|---|---|
| QA-CAND-01 | **Pendente manual** | Google OAuth no browser (opcional vs e-mail/senha) |
| QA-CAND-03 | **Pass (RLS 10)** | apply + snapshot D-08 |
| QA-CAND-06 | **Pass (RLS 12)** | withdraw submitted/reviewing |
| QA-CAND-10 | **Parcial Vitest** | `MyApplications.test.jsx`; **pendente manual** dashboard real |
| QA-CAND-11 | **Pass (RLS 2, 11)** | Sem INSERT apply direto; isolamento candidato |

### Curador / Moderador / Admin

| ID | Resultado | Evidência |
|---|---|---|
| QA-CUR-05 | **Pass (RLS 5)** | Quórum 2× approve → `approved` |
| QA-MOD-01 | **Pass (RLS 7)** | Moderador resolve empate |
| QA-ADM-02 | **Pass (RLS admin)** | Admin cadastra `pending`; visitante não vê |
| QA-ADM-07 | **Pass (automatizado parcial)** | Playwright local T1 ~84 ms · spinner 0/5 (#43–#44). **Pendente manual** homolog |
| QA-ADM-08 | **Pass (Vitest)** | `Admin.test.jsx` — fila mount tardio + `hidden`. **Pendente manual** homolog |
| QA-ADM-09 | **Pendente manual** | Mobile admin tabs + form (#38) |

### Segurança transversal (baseline)

| ID | Resultado | Evidência |
|---|---|---|
| QA-SEC-03 | **Pass (RLS 10–12)** | Candidato só apply/withdraw via RPC |
| QA-SEC-01 | **Pendente manual** | `git status` — sem `.env` staged |
| QA-SEC-02 | **Pendente manual** | DevTools bundle — sem `service_role` |
| QA-SEC-07 | **Pass (doc)** | Seis controles LGPD ainda pendentes — produção bloqueada |

## Backlog gerado

| Finding | Item backlog / PR | Prioridade |
|---|---|---|
| F-015 | #37, #39 | — resolvido |
| F-016 | #39 | — resolvido |
| F-017 | #40 | — resolvido |
| PERF-CAT-02 | Cold load home &lt;900 ms | P2 opcional |

## Próximo passo

1. **Humano:** percorrer QA-ADM-07..09, QA-ANON-10 e demais *Pendente manual* P0 no browser homolog.
2. **Plan:** após evidências → atualizar colunas *Resultado* neste arquivo.
3. **C-05:** fechar Resend para Sprint 7 (paralelo).

## Aprovação

| Papel | Nome | Data | Homologação OK para próximo sprint? |
|---|---|---|---|
| Plan TL | closeout docs #37–#45 | 2026-09-08 | ☐ Sim ☐ Não — aguarda manual P0 |
| PO | | | |
