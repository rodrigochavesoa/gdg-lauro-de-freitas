# QA-SEC-01 — Assessment de homologação

**Status:** QA-SEC-01b concluído · QA-SEC-01a browser concluído · QA-SEC-01d revisão estática concluída · **F-019 fechado (#51)**  
**Ambiente:** GDG-JOBS-SENAI (`pcdfxnfhgdmzmcmlhxuv`) · app local `http://localhost:5173` · **`main` @ `bb3af9b`** (#51–#57)  
**Setup:** SETUP-HOMOLOG-01 **ok** — 6 papéis; `docs-local/` + baseline automatizado verde.  
**Ferramentas:** Playwriter 0.5.0 (01a) · Codex CLI + revisão Plan (01d) · `pnpm test:rls` **1–13** (2026-09-08).

## Resumo executivo

| Métrica | Valor |
|---|---|
| Casos P0 (automatizado + manual 01a) | 18 auto + 9 manuais browser |
| Passou (automatizado) | 18 |
| Passou (manual browser 01a) | 9 |
| Falhou | 0 |
| Bloqueado (env/credencial) | 0 |
| Findings abertos (Critical/High) | 1 (F-020 High) |
| Findings Medium abertos | 1 (F-021) |
| Findings resolvidos recentes | F-019 (#51) · F-018 (#49) · UX perf/header (#52–#57) |
| Findings UX resolvidos (#37–#45) | F-015, F-016, F-017 |

## Baseline automatizado

| Comando | Resultado | Log / notas |
|---|---|---|
| `pnpm lint` | **pass** | `eslint .` — exit 0 |
| `pnpm test` | **pass** (88/88) | Vitest 3.2.4; `Test Files  17 passed (17)`; exit 0 |
| `pnpm run build` | **pass** | Vite 8.2.1; exit 0 |
| `pnpm test:rls` | **pass** | Cenários **1–13** · **0** FALHA (2026-09-08) — F-019 coberto no cenário 13 |

## QA-SEC-01d — Revisão estática (2026-09-08)

**Agente:** Codex CLI + revisão Plan · **Escopo:** baseline `main` (não introduzido por F-018/#49).

### Controles verificados (Pass)

| ID | Resultado | Evidência |
|---|---|---|
| QA-SEC-02 | **Pass** | Sem `service_role` no bundle/`src` |
| QA-SEC-04 | **Pass (P1 spot)** | Sem `dangerouslySetInnerHTML` / `innerHTML` em `src/` |
| QA-SEC-03 (apply RPC) | **Pass** | Candidato só apply/withdraw via RPC (`test:rls` 10–12) |

### Achados 01d — status pós-merge

| ID | Sev | Status | Correção |
|---|---|---|---|
| F-019 | Critical | **Resolvido #51** | Migration `20260908150000_profile_insert_role_candidate.sql` + cenário 13 |
| F-020 | High | Aberto | `match-jobs` → Gemini sem gate C-04 — Sprint 7+ |
| F-021 | Medium | Aberto | OAuth `redirectTo` depende de allowlist Supabase |

### Recomendação Plan (01d — atualizada)

- **F-019 fechado** — homolog **não** bloqueada por privilege escalation em `profiles` INSERT.
- **Produção** continua bloqueada pelos **seis controles LGPD** + F-020/F-021 + C-05.
- Próxima prioridade funcional: **C-05 → Sprint 7 (Resend)**.

---

## QA-SEC-01a — Relatório Visual QA (2026-09-08)

### Resumo

Homolog visual P0 em `http://localhost:5173`. Ordem: anon → OAuth candidato → sign out → admin. Light/Dark OK; sem regressão crítica pós #37–#45.

### Achados (01a)

| ID | Sev | QA ref | Evidência | Correção |
|---|---|---|---|---|
| F-018 | Info | QA-ADM-01 | Copy Sprint 5 no gate `/admin` | **Resolvido** #49 |

### Evidências (15)

Pasta [`docs/assets/qa-sec-01a/`](assets/qa-sec-01a/) — ver PR #48.

### UX perf / header (2026-09-08 tarde)

| Escopo | Resultado | Evidência |
|---|---|---|
| UX-PERF-02–04 | **Pass** Visual QA | [`ux-perf-02-04-visual-qa.md`](ux-perf-02-04-visual-qa.md) · PR #55 |
| UX-PERF-05 | **Pass** (preservado no stack) | [`ux-perf-05-home-scroll.md`](ux-perf-05-home-scroll.md) · PR #54 |
| UX-HEADER-01 | **Pass** (código #52 + assets #57) | [`docs/assets/ux-header-01/`](assets/ux-header-01/) |

---

## Findings — resolvidos

| ID | QA ref | Severidade | Título | Correção | PR |
|---|---|---|---|---|---|
| F-015 | QA-ADM-07 | Medium | Nav admin assimétrica | Tabs unificadas | #37, #39 |
| F-016 | QA-ADM-07 | Low | Card perfil duplicado | Removido `.admin-user` | #39 |
| F-017 | QA-ADM-03 | Low | Lista vagas desorganizada | Seções pending/approved | #40 |
| F-018 | QA-ADM-01 | Info | Copy login admin desatualizado | Microcopy staff vs candidato | #49 |
| F-019 | QA-ADM-02, QA-CAND-12 | **Critical** | Escalação de role no INSERT de `profiles` | Policy `role = candidate` + `test:rls` 13 | #51 |

## Findings — abertos

| ID | QA ref | Severidade | Título | Descrição | Reprodução | Correção sugerida | Owner | Sprint/PR |
|---|---|---|---|---|---|---|---|---|
| F-020 | QA-SEC-07 | **High** | `match-jobs` → Gemini sem gate LGPD | Perfil candidato enviado a embedding | Chamar Edge Function autenticado | Desligado até C-04; consentimento | Plan | Sprint 7+ |
| F-021 | QA-SEC-05 | **Medium** | OAuth redirect depende de allowlist | `window.location.origin` dinâmico | Preview/prod com allowlist ampla | Allowlist estrita por ambiente | Humano + Executor | config |

**Severidade:** Critical · High · Medium · Low · Info

## Matriz P0 — resultados

Referência: [`qa-test-plan-homolog.md`](qa-test-plan-homolog.md).

### Segurança transversal

| ID | Resultado | Evidência |
|---|---|---|
| QA-SEC-01 | **Pass (spot)** | Sem `.env` staged nos PRs doc/código |
| QA-SEC-02 | **Pass (01a + 01d)** | Sem `service_role` no frontend |
| QA-SEC-03 | **Pass** | RPC apply/withdraw ok; F-019 fechado (#51) |
| QA-SEC-04 | **Pass (01d spot)** | XSS React text nodes — sem innerHTML |
| QA-SEC-05 | **Pass homolog / Medium F-021** | Allowlist `localhost:5173` documentada; preview futuro = auditar |
| QA-SEC-07 | **Pass (doc gate)** | Produção bloqueada — LGPD + F-020 |

*(Demais linhas anon/candidato/admin — ver PR #48 / seção 01a; mantidas Pass.)*

## Backlog gerado

| Finding | Item backlog / PR | Prioridade |
|---|---|---|
| F-020 | C-04 + gate `match-jobs` | High — Sprint 7+ |
| F-021 | Auditar allowlist OAuth preview/prod | Medium |
| PERF-CAT-02 | Cold load home &lt;900 ms | P2 opcional |

## Próximo passo

1. **Humano / PO — C-05:** Resend + domínio + API key em `docs-local/` → avisar Plan.
2. **Plan:** ONE-LINER **Sprint 7** (Resend) após C-05.
3. **Humano / PO:** aceite DS-05 formal + QA P0 restante (QA-ADM-07..09 admin perf/nav).
4. **DPO:** bases legais e-mail (P-20); gate C-04 antes de habilitar F-020.

## Aprovação

| Papel | Nome | Data | Homologação OK para próximo sprint? |
|---|---|---|---|
| Frontend Visual QA | QA-SEC-01a + UX-PERF-02–04 | 2026-09-08 | ☑ Sim (#48, #55) |
| Plan TL | F-019 #51 + handoff #49–#57 | 2026-09-08 | ☑ Sim homolog · ☐ Não prod (LGPD) |
| PO | | | |
