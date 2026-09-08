# QA-SEC-01 — Assessment de homologação

**Status:** QA-SEC-01b concluído · QA-SEC-01a browser concluído · **QA-SEC-01d revisão estática concluída** (2026-09-08)  
**Ambiente:** GDG-JOBS-SENAI (`pcdfxnfhgdmzmcmlhxuv`) · app local `http://localhost:5173` · **`main` @ `46a23ae`** (#49 F-018)  
**Setup:** SETUP-HOMOLOG-01 **ok** — 6 papéis; `docs-local/` + baseline automatizado verde.  
**Ferramentas:** Playwriter 0.5.0 (01a) · Codex CLI + revisão Plan (01d estático) · `pnpm test:rls` 1–12 (última exec. 2026-09-07).

## Resumo executivo

| Métrica | Valor |
|---|---|
| Casos P0 (automatizado + manual 01a) | 18 auto + 9 manuais browser |
| Passou (automatizado) | 18 |
| Passou (manual browser 01a) | 9 |
| Falhou | 0 |
| Bloqueado (env/credencial) | 0 |
| Findings abertos (Critical/High) | 2 (F-019 Critical; F-020 High) |
| Findings Medium abertos | 1 (F-021) |
| Findings Info resolvidos recentes | F-018 (#49) |
| Findings UX resolvidos (#37–#45) | F-015, F-016, F-017 |

## Baseline automatizado

| Comando | Resultado | Log / notas |
|---|---|---|
| `pnpm lint` | **pass** | `eslint .` — exit 0 |
| `pnpm test` | **pass** (80/80) | Vitest 3.2.4; `Test Files  17 passed (17)`; exit 0 |
| `pnpm run build` | **pass** | Vite 8.2.1; exit 0 |
| `pnpm test:rls` | **pass** | Cenários **1–12** · **0** FALHA (2026-09-07) — **não cobre F-019** (cenário 13 pendente) |

## QA-SEC-01d — Revisão estática (2026-09-08)

**Agente:** Codex CLI + revisão Plan · **Escopo:** baseline `main` (não introduzido por F-018/#49).

### Controles verificados (Pass)

| ID | Resultado | Evidência |
|---|---|---|
| QA-SEC-02 | **Pass** | Sem `service_role` no bundle/`src` |
| QA-SEC-04 | **Pass (P1 spot)** | Sem `dangerouslySetInnerHTML` / `innerHTML` em `src/` |
| QA-SEC-03 (apply RPC) | **Pass parcial** | Candidato só apply/withdraw via RPC (`test:rls` 10–12) — **independente** de F-019 |

### Achados abertos (01d)

| ID | Sev | QA ref | Local | Problema | Reprodução / impacto | Correção sugerida | Owner |
|---|---|---|---|---|---|---|---|
| F-019 | **Critical** | QA-ADM-02, QA-CAND-12 | `supabase/migrations/202608150001_ai_matching.sql` L88 | Policy INSERT em `profiles` valida só `id = auth.uid()` — cliente pode inserir `role: 'admin'` (ou `curator`/`moderator`) | POST insert `{ id, full_name, role: 'admin' }` → `is_admin()` true → acesso staff | Migration: `WITH CHECK (role = 'candidate')` + cenário `test:rls` 13 | Executor |
| F-020 | **High** (Critical se deploy) | QA-SEC-07, P-16 | `supabase/functions/match-jobs/index.ts` L17–20 | Envia `headline`/`bio`/`skills` ao Gemini sem gate C-04/consentimento | `POST /functions/v1/match-jobs` com JWT candidato | Manter desligado até C-04/DPO; gate + minimização | Plan / Sprint 7+ |
| F-021 | **Medium** | QA-SEC-05 | `src/features/auth/auth-api.js` L94–97 | OAuth `redirectTo = window.location.origin` — segurança depende de allowlist Supabase exata | Origem não allowlisted → risco open redirect | Allowlist exata por ambiente; HTTPS fora de localhost | Humano + Executor |

### Recomendação Plan (01d)

- **APROVADO** registro dos findings — baseline homolog **não** pronto para produção enquanto **F-019** aberto.
- **Prioridade imediata:** ONE-LINER F-019 (migration RLS + cenário 13).
- F-020 / F-021: backlog; não bloqueiam merge de polish UI.

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

---

## Findings — resolvidos

| ID | QA ref | Severidade | Título | Correção | PR |
|---|---|---|---|---|---|
| F-015 | QA-ADM-07 | Medium | Nav admin assimétrica | Tabs unificadas | #37, #39 |
| F-016 | QA-ADM-07 | Low | Card perfil duplicado | Removido `.admin-user` | #39 |
| F-017 | QA-ADM-03 | Low | Lista vagas desorganizada | Seções pending/approved | #40 |
| F-018 | QA-ADM-01 | Info | Copy login admin desatualizado | Microcopy staff vs candidato | #49 |

## Findings — abertos

| ID | QA ref | Severidade | Título | Descrição | Reprodução | Correção sugerida | Owner | Sprint/PR |
|---|---|---|---|---|---|---|---|---|
| F-019 | QA-ADM-02 | **Critical** | Escalação de role no INSERT de `profiles` | Policy INSERT não restringe `role` | Insert com `role: 'admin'` na criação do perfil | Migration + `test:rls` 13 | Executor frontend | fix/f019 |
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
| QA-SEC-03 | **Pass parcial** | RPC apply/withdraw ok; **F-019** = vetor separado (privilege escalation) |
| QA-SEC-04 | **Pass (01d spot)** | XSS React text nodes — sem innerHTML |
| QA-SEC-05 | **Pass homolog / Medium F-021** | Allowlist `localhost:5173` documentada; preview futuro = auditar |
| QA-SEC-07 | **Pass (doc gate)** | Produção bloqueada — LGPD + F-020 |

*(Demais linhas anon/candidato/admin — ver PR #48 / seção 01a; mantidas Pass.)*

## Backlog gerado

| Finding | Item backlog / PR | Prioridade |
|---|---|---|
| F-019 | fix/f019-profile-role-rls | **P0 segurança** |
| F-020 | C-04 + gate `match-jobs` | High — Sprint 7+ |
| F-021 | Auditar allowlist OAuth preview/prod | Medium |
| PERF-CAT-02 | Cold load home &lt;900 ms | P2 opcional |

## Próximo passo

1. **Merge PR doc** `docs/qa-sec-01d-static-review` — registrar F-019..021.
2. **Executor:** ONE-LINER F-019 — migration + cenário 13 + aplicar migration homolog.
3. **C-05:** Resend Sprint 7 (paralelo).

## Aprovação

| Papel | Nome | Data | Homologação OK para próximo sprint? |
|---|---|---|---|
| Frontend Visual QA | QA-SEC-01a | 2026-09-08 | ☑ Sim (#48) |
| Plan TL | QA-SEC-01d + F-018 #49 | 2026-09-08 | ☐ Sim ☐ Não — **F-019 bloqueia prod** |
| PO | | | |
