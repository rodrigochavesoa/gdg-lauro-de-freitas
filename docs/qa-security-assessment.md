# QA-SEC-01 — Assessment de homologação

**Status:** QA-SEC-01b concluído · QA-SEC-01a browser concluído · QA-SEC-01d revisão estática + **pentest exploratório concluído** · **F-019 fechado (#51)** · **F-024 fechado (#62)** · **F-021 Pass homolog (#63)** · **F-023 fechado**  
**Ambiente:** GDG-JOBS-SENAI (`pcdfxnfhgdmzmcmlhxuv`) · app local `http://localhost:5173` · **`main` @ `4e5c59e`** (#61–#63)  
**Setup:** SETUP-HOMOLOG-01 **ok** — 6 papéis; `docs-local/` + baseline automatizado verde.  
**Ferramentas:** Playwriter 0.5.0 (01a + F-021 callback) · Codex CLI pentest + revisão Plan (01d) · `pnpm test:rls` **1–14** (F-023).

## Resumo executivo

| Métrica | Valor |
|---|---|
| Casos P0 (automatizado + manual 01a) | 18 auto + 9 manuais browser |
| Passou (automatizado) | 18 |
| Passou (manual browser 01a) | 9 |
| Falhou | 0 |
| Bloqueado (env/credencial) | 0 |
| Findings abertos (Critical/High) | 1 (F-020 High) |
| Findings Medium abertos | 0 (F-021 **Pass homolog**) |
| Findings Low/Info abertos | 0 |
| Findings resolvidos recentes | F-023 · F-021 · F-024 (#62) · F-019 (#51) · F-018 (#49) · UX perf/header (#52–#57) · PERF-ADM-05 (#59–#60) |
| Findings UX resolvidos (#37–#45) | F-015, F-016, F-017 |

## Baseline automatizado

| Comando | Resultado | Log / notas |
|---|---|---|
| `pnpm lint` | **pass** | `eslint .` — exit 0 |
| `pnpm test` | **pass** (95/95) | Vitest 3.2.4; `Test Files  17 passed (17)`; exit 0 |
| `pnpm run build` | **pass** | Vite 8.2.1; exit 0 |
| `pnpm test:rls` | **pass** | Cenários **1–14** · **0** FALHA — F-023 cenário 14 (`rate limit exceeded` na 6ª `apply_to_job`) |

## QA-SEC-01d — Pentest exploratório de homologação (2026-09-08)

**Agente:** Codex CLI (pentest) + revisão Plan · **Escopo:** homologação Supabase, usuários de teste em `docs-local/`, sem produção e sem persistência de payloads ofensivos. Não houve alteração de código de produto.

### Resultados

| Área | Resultado | Evidência |
|---|---|---|
| QA-SEC-01/02 — segredos | **Pass** | Nenhum `.env` versionado, JWT ou `service_role` no frontend. `dist` contém somente a publishable key esperada. |
| QA-SEC-03 / QA-ANON-* | **Pass** | Anon recebeu 0 linhas em `profiles`, `applications` e `jobs.pending`; RPC de curadoria rejeitada. Probe F-019 conta nova validado no cenário 13 (F-024 fechado). |
| QA-CAND-11/12 | **Pass** | Candidato não leu perfil/aplicações de outro usuário. INSERT direto de job, review e application rejeitado. PATCH de `profiles.role` rejeitado. |
| IDOR `/jobs/:id` | **Pass** | UUID pending e inexistente retornaram zero linhas; vaga approved retornou uma linha pública. Sem isolamento por tenant no modelo atual. |
| D-09 / apply | **Pass** | Duplicidade, withdraw/reapply, reviewing e accepted passaram nos cenários 10–12. |
| QA-SEC-04 — XSS | **Pass (estático)** | Payloads ofensivos não persistidos. Sem `dangerouslySetInnerHTML`/`innerHTML` em `src/`; campos renderizados como texto React. |
| QA-SEC-05 — OAuth | **Pass homolog / F-021** | Callback completo (Playwriter): Caso A aterrissa em `http://127.0.0.1:5173/` com sessão. Caso B `redirectTo` externo → authorize 302 `accounts.google.com`; callback 303 Site URL `localhost:3000` — **não** o atacante. Ver [`qa-sec-f021-oauth-visual-qa.md`](qa-sec-f021-oauth-visual-qa.md). |
| QA-SEC-06 — abuse | **Pass / F-023 fechado** | 6ª `apply_to_job` / 60s → `rate limit exceeded` (cenário 14). Limite: 5 chamadas / 60s por `auth.uid()`. |

### Findings do pentest

| ID | Sev | QA ref | Vetor | Impacto | Mitigação |
|---|---|---|---|---|---|
| F-023 | Low/Info | QA-SEC-06 | Spam de apply autenticado | **Fechado** — 5/60s em `apply_to_job` + cenário 14 | Migration `20260909003920_apply_rate_limit.sql` |

**F-023 — fechado:** `apply_to_job` limita 5 chamadas / 60s por `auth.uid()` (`apply_request_log`, `rate limit exceeded` / PT429). Cenário 14 em `pnpm test:rls`. Doc: [`s6-apply-flow.md`](s6-apply-flow.md).

**F-024 — fechado (2026-09-08):** cenário 13 usa `auth.admin.createUser` + `@example.com` (requer `SUPABASE_SERVICE_ROLE_KEY` local, não commitada) + cleanup `deleteUser`/`profiles`. Primeiro INSERT com `role = admin` bloqueado pela policy; sem `IGNORADO`.

**F-019** permanece **fechado** (#51): migration `20260908150000_profile_insert_role_candidate.sql` exige `role = 'candidate'` no INSERT. Cenário 13 cobre UPDATE/INSERT em conta existente e probe dinâmico em conta nova.

**F-021 Pass homolog (2026-09-08 Visual QA):** callback OAuth completo executado. Caso A → `http://127.0.0.1:5173/` com sessão. Caso B não redireciona ao domínio atacante (303 Site URL). Residual: Site URL Dashboard = `http://localhost:3000`; Additional Redirect URLs preview/prod = humano. Relatório [`qa-sec-f021-oauth-visual-qa.md`](qa-sec-f021-oauth-visual-qa.md).

**F-020** (`match-jobs` → Gemini sem gate LGPD) **fora do escopo** deste pentest; permanece aberto.

### Log de comandos/probes

- `git status --short --branch`
- `git grep`/`rg` — padrões `.env`, JWT, `service_role`, `sb_secret_` em arquivos versionados/`src`/`dist`
- `pnpm test:rls` — cenários **1–14** (F-023 cenário 14); cenário 13 probe Admin API + cleanup (F-024 fechado)
- Probe Supabase — isolamento RLS, writes diretos, IDOR e apply repetido
- Probe `auth/v1/authorize` — localhost vs origem externa inválida

Nenhum valor de chave, JWT, senha ou dado pessoal foi registrado.

---

## QA-SEC-01d — Revisão estática (2026-09-08)

**Agente:** Codex CLI + revisão Plan · **Escopo:** baseline `main` (não introduzido por F-018/#49).

### Controles verificados (Pass)

| ID | Resultado | Evidência |
|---|---|---|
| QA-SEC-02 | **Pass** | Sem `service_role` no bundle/`src` |
| QA-SEC-04 | **Pass (P1 spot)** | Sem `dangerouslySetInnerHTML` / `innerHTML` em `src/` |
| QA-SEC-03 (apply RPC) | **Pass** | Candidato só apply/withdraw via RPC (`test:rls` 10–12). Probe F-019 conta nova: cenário 13 dinâmico (F-024). |

### Achados 01d — status pós-merge

| ID | Sev | Status | Correção |
|---|---|---|---|
| F-019 | Critical | **Resolvido #51** | Migration `20260908150000_profile_insert_role_candidate.sql` + cenário 13 |
| F-020 | High | Aberto | `match-jobs` → Gemini sem gate C-04 — Sprint 7+ |
| F-021 | Medium | **Pass homolog** | Callback completo Caso A+B; residual Site URL `:3000` + allowlist preview |

### Recomendação Plan (01d — atualizada)

- **F-019 fechado** — homolog **não** bloqueada por privilege escalation em `profiles` INSERT.
- **Produção** continua bloqueada pelos **seis controles LGPD** + F-020 + C-05. F-021 **não** bloqueia homolog (open redirect não reproduzido).
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

### F-021 / QA-SEC-05 OAuth callback (2026-09-08 noite)

| Escopo | Resultado | Evidência |
|---|---|---|
| Caso A callback Google | **Pass** | Landing `http://127.0.0.1:5173/` sessão ativa · light/dark |
| Caso B `redirectTo` externo | **Pass** | 302 Google · 303 Site URL `localhost:3000` ≠ atacante |

Relatório: [`qa-sec-f021-oauth-visual-qa.md`](qa-sec-f021-oauth-visual-qa.md) · assets [`docs/assets/qa-sec-f021/`](assets/qa-sec-f021/).

---

## Findings — resolvidos

| ID | QA ref | Severidade | Título | Correção | PR |
|---|---|---|---|---|---|
| F-015 | QA-ADM-07 | Medium | Nav admin assimétrica | Tabs unificadas | #37, #39 |
| F-016 | QA-ADM-07 | Low | Card perfil duplicado | Removido `.admin-user` | #39 |
| F-017 | QA-ADM-03 | Low | Lista vagas desorganizada | Seções pending/approved | #40 |
| F-018 | QA-ADM-01 | Info | Copy login admin desatualizado | Microcopy staff vs candidato | #49 |
| F-019 | QA-ADM-02, QA-CAND-12 | **Critical** | Escalação de role no INSERT de `profiles` | Policy `role = candidate` + `test:rls` 13 | #51 |
| F-024 | QA-SEC-03 | Low | Lacuna teste F-019 conta nova | Admin API probe + cleanup no cenário 13 | `fix/f024-rls-scenario13-signup-email` |
| F-021 | QA-SEC-05 | Medium | OAuth open redirect inconclusivo (só preflight 302) | Callback completo Caso A+B — sem redirect ao atacante | [`qa-sec-f021-oauth-visual-qa.md`](qa-sec-f021-oauth-visual-qa.md) |
| F-023 | QA-SEC-06 | Low/Info | Apply sem rate limit | 5/60s em `apply_to_job` + cenário 14 | `fix/f023-apply-rate-limit` (#64) |

## Findings — abertos

| ID | QA ref | Severidade | Título | Descrição | Reprodução | Correção sugerida | Owner | Sprint/PR |
|---|---|---|---|---|---|---|---|---|
| F-020 | QA-SEC-07 | **High** | `match-jobs` → Gemini sem gate LGPD | Perfil candidato enviado a embedding | Chamar Edge Function autenticado | Desligado até C-04; consentimento | Plan | Sprint 7+ |

**Severidade:** Critical · High · Medium · Low · Info

## Matriz P0 — resultados

Referência: [`qa-test-plan-homolog.md`](qa-test-plan-homolog.md).

### Segurança transversal

| ID | Resultado | Evidência |
|---|---|---|
| QA-SEC-01 | **Pass (spot)** | Sem `.env` staged nos PRs doc/código |
| QA-SEC-02 | **Pass (01a + 01d)** | Sem `service_role` no frontend |
| QA-SEC-03 | **Pass** | RPC apply/withdraw ok; F-019 + F-024 fechados (cenário 13 dinâmico) |
| QA-SEC-04 | **Pass (01d spot)** | XSS React text nodes — sem innerHTML |
| QA-SEC-05 | **Pass homolog** | [`qa-sec-f021-oauth-visual-qa.md`](qa-sec-f021-oauth-visual-qa.md) · Caso A sessão `/` · Caso B 303 ≠ atacante |
| QA-SEC-06 | **Pass (F-023)** | 5 `apply_to_job` / 60s; 6ª → `rate limit exceeded` (cenário 14) |
| QA-SEC-07 | **Pass (doc gate)** | Produção bloqueada — LGPD + F-020 |

*(Demais linhas anon/candidato/admin — ver PR #48 / seção 01a; mantidas Pass.)*

## Backlog gerado

| Finding | Item backlog / PR | Prioridade |
|---|---|---|
| F-020 | C-04 + gate `match-jobs` | High — Sprint 7+ |
| F-021 | Allowlist OAuth preview/prod (sem wildcard) + Site URL Dashboard ≠ `:3000` | P2 residual — homolog Pass |
| PERF-CAT-02 | Cold load home &lt;900 ms | P2 opcional |

## Próximo passo

1. **Humano / PO — C-05:** Resend + domínio + API key em `docs-local/` → avisar Plan.
2. **Plan:** ONE-LINER **Sprint 7** (Resend) após C-05.
3. **Humano / PO:** aceite DS-05 formal + QA P0 restante (QA-ADM-07..09 admin perf/nav).
4. **DPO:** bases legais e-mail (P-20); gate C-04 antes de habilitar F-020.

## Aprovação

| Papel | Nome | Data | Homologação OK para próximo sprint? |
|---|---|---|---|
| Frontend Visual QA | QA-SEC-01a + UX-PERF + **F-021 OAuth callback** | 2026-09-08 | ☑ Sim (#48, #55; QA-SEC-05 Pass homolog) |
| Plan TL | F-019 #51 + pentest 01d + F-021/F-023 homolog | 2026-09-08 | ☑ Sim homolog · ☐ Não prod (LGPD) |
| PO | | | |
