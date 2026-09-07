# QA-SEC-01 — Assessment de homologação

**Status:** QA-SEC-01b concluído · QA-SEC-01a manual browser **pendente**  
**Ambiente:** GDG-JOBS-SENAI (`pcdfxnfhgdmzmcmlhxuv`) · **`main` @ `ed336ab`** · **Data de execução:** 2026-09-07  
**Setup:** SETUP-HOMOLOG-01 **ok** — 6 papéis já existiam; `docs-local/` + `test:rls` 1–12 verdes.  
**Revalidação:** Revalidado pelo Executor em 2026-09-07; sem divergência. Quatro comandos reexecutados na branch `docs/qa-sec-01b-baseline` @ `ed336ab`.

## Resumo executivo

| Métrica | Valor |
|---|---|
| Casos P0 executados | 18 / ~35 (baseline RLS + Vitest; manual browser pendente) |
| Passou (automatizado) | 18 |
| Falhou | 0 |
| Bloqueado (env/credencial) | 0 |
| Findings abertos (Critical/High) | 0 |

## Baseline automatizado

| Comando | Resultado | Log / notas |
|---|---|---|
| `pnpm lint` | **pass** | `eslint .` — exit 0 |
| `pnpm test` | **pass** (55/55) | Vitest 3.2.4; `Test Files  13 passed (13)`; `Tests  55 passed (55)`; exit 0 |
| `pnpm run build` | **pass** | Vite 8.2.1; exit 0; chunk `index-Bs9CDI71.js` 504.78 kB (aviso >500 kB, info) |
| `pnpm test:rls` | **pass** | Cenários **1–12** executados; **0** FALHA; exit 0; mensagem final: `RLS curadoria + apply V1: ok (0 aviso(s) opcionais; cenários 3–12 executados).` |

## Findings (preencher por linha)

| ID | QA ref | Severidade | Título | Descrição | Reprodução | Correção sugerida | Owner | Sprint/PR |
|---|---|---|---|---|---|---|---|---|
| — | — | — | *(nenhum no baseline)* | | | | | |

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
| — | — | — |

## Próximo passo

**QA-SEC-01a manual:** ONE-LINER browser para linhas *Pendente manual* acima → atualizar este arquivo → PR docs.

## Aprovação

| Papel | Nome | Data | Homologação OK para próximo sprint? |
|---|---|---|---|
| Plan TL | (baseline QA-SEC-01b) | 2026-09-07 | ☐ Sim ☐ Não — aguarda manual P0 |
| PO | | | |
