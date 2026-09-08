# QA-SEC-01 — Plano de testes de homologação (matriz inicial)

**Épico:** QA-SEC-01 — Avaliação homologação defensiva.  
**Ambiente:** Supabase **GDG-JOBS-SENAI** + app local (`pnpm dev`) ou preview futuro.  
**Dados:** fictícios ou autorizados; usuários de teste em `docs-local/` (gitignored).

**Saída desta fase:** preencher colunas *Resultado*, *Evidência* e *Finding ID* em [`qa-security-assessment.md`](qa-security-assessment.md) (template QA-SEC-01e).

---

## Como usar a matriz

| Coluna | Significado |
|---|---|
| **ID** | Identificador rastreável (`QA-ANON-01`, etc.) |
| **Papel** | Anon, Candidato, Curador, Moderador, Admin |
| **Tipo** | Funcional (F), Segurança/RLS (S), UX/A11y (U), Regressão (R) |
| **Auto** | `Vitest` \| `test:rls` \| `manual` \| `E2E` (futuro) |
| **RLS** | Cenário em `pnpm test:rls` quando existir |
| **Prioridade** | P0 bloqueante homologação · P1 importante · P2 polish |

**Comandos baseline (pwsh):**

```powershell
pnpm lint && pnpm test && pnpm run build
pnpm test:rls   # requer .env.local + docs-local/*-test-user.md
```

---

## Matriz — Visitante anônimo

| ID | Fluxo / critério | Tipo | Auto | RLS | P | Passos resumidos |
|---|---|---|---|---|---|---|
| QA-ANON-01 | Home lista só vagas `approved` | S | test:rls | 1 | P0 | Anon: SELECT jobs; pending invisível |
| QA-ANON-02 | Detalhe de vaga approved público | F | smoke | 1 | P0 | Abrir `/jobs/:id` seed approved |
| QA-ANON-03 | Detalhe pending/ inexistente bloqueado | S | test:rls / manual | 1 | P0 | ID pending → 404 ou indisponível |
| QA-ANON-04 | Busca e filtros no catálogo | F | Vitest + manual | — | P1 | Query, tech, level; empty state |
| QA-ANON-05 | Sort Mais recentes / antigas (desktop) | F | smoke | — | P1 | Menu sort; ordem por `postedAt` |
| QA-ANON-06 | `profiles` / `applications` inacessíveis | S | test:rls | 1 | P0 | Anon SELECT → vazio ou negado |
| QA-ANON-07 | CTA apply → login (sem sessão) | F | smoke + manual | — | P0 | Detalhe: candidatar redireciona login |
| QA-ANON-08 | Admin / curadoria / minhas candidaturas inacessíveis | S | manual | — | P0 | URLs protegidas → login ou redirect |
| QA-ANON-09 | Skeleton catálogo enquanto carrega | U | manual | — | P2 | Grade com placeholders, não empty longo |
| QA-ANON-10 | CTA “Criar perfil gratuito” → login | F | smoke | — | P0 | Home `.cta`: link `/login`; seção oculta se logado (#45) |

---

## Matriz — Candidato (OAuth Google)

| ID | Fluxo / critério | Tipo | Auto | RLS | P | Passos resumidos |
|---|---|---|---|---|---|---|
| QA-CAND-01 | Login Google + sessão persistida | F | manual | 2 | P0 | Entrar; Header logado |
| QA-CAND-02 | Onboarding D-01 gate | F | Vitest + manual | — | P0 | Perfil incompleto → `/onboarding` |
| QA-CAND-03 | Apply 1 clique em vaga approved | F+S | test:rls | 10 | P0 | RPC `apply_to_job`; snapshot D-08 |
| QA-CAND-04 | Duplicidade apply bloqueada | S | test:rls | 11 | P0 | Segundo apply → erro estável |
| QA-CAND-05 | Perfil incompleto bloqueia apply | S | test:rls | 11 | P0 | Sem D-01 → não aplica |
| QA-CAND-06 | Withdraw submitted/reviewing | F+S | test:rls | 12 | P0 | Retirar; status `withdrawn` |
| QA-CAND-07 | Sem reapply após withdrawn (D-09) | S | manual + test:rls | 12 | P0 | CTA apply ausente ou erro |
| QA-CAND-08 | Detalhe: sem flash CTA apply | U | smoke | — | P1 | “Verificando…” → estado aplicado |
| QA-CAND-09 | Falha verificação: alert, sem CTA azul | U | Vitest + manual | — | P1 | Rede/API fail simulado |
| QA-CAND-10 | `/minhas-candidaturas` lista e withdraw | F | Vitest + manual | — | P0 | Dashboard; link Header |
| QA-CAND-11 | Candidato não lê perfil/candidatura alheia | S | test:rls | 2 | P0 | SELECT outro `candidate_id` → negado |
| QA-CAND-12 | Candidato não escreve job/curadoria | S | test:rls | 2 | P0 | INSERT job / review → negado |
| QA-CAND-13 | Sign out encerra sessão | F | manual | — | P1 | Logout; rotas protegidas fecham |

---

## Matriz — Curador

| ID | Fluxo / critério | Tipo | Auto | RLS | P | Passos resumidos |
|---|---|---|---|---|---|---|
| QA-CUR-01 | Fila curadoria visível (pending) | F | manual | 3 | P0 | UI fila + rubrica |
| QA-CUR-02 | Review único registrado | S | test:rls | 3 | P0 | RPC review; append-only |
| QA-CUR-03 | Self-review bloqueado | S | test:rls | 4 | P0 | Curador não revisa própria submissão |
| QA-CUR-04 | Review duplicado bloqueado | S | test:rls | 4 | P0 | Segundo review mesmo par → erro |
| QA-CUR-05 | Quórum aprova (3 curadores) | S | test:rls | 5 | P0 | Vaga → `approved`; catálogo |
| QA-CUR-06 | Empate / rejeição por quórum | S | test:rls | 6 | P0 | Status `rejected` ou pending conforme regra |
| QA-CUR-08 | Reenvio após rejeição | F+S | test:rls | 8 | P1 | `resubmit`; round incrementa |
| QA-CUR-09 | Curador não altera `role` / admin CRUD | S | manual + test:rls | 2 | P0 | Sem acesso Admin write amplo |

*Moderador:* cenários QA-CUR-05/06 estendidos em **QA-MOD-*** (RLS 7).

---

## Matriz — Moderador

| ID | Fluxo / critério | Tipo | Auto | RLS | P | Passos resumidos |
|---|---|---|---|---|---|---|
| QA-MOD-01 | Desempate / moderação fila | S | test:rls | 7 | P0 | RPC moderação conforme D-03–D-06 |
| QA-MOD-02 | Moderador não bypassa quórum sem regra | S | test:rls | 7 | P0 | Tentativa write direto negada |

---

## Matriz — Administrador

| ID | Fluxo / critério | Tipo | Auto | RLS | P | Passos resumidos |
|---|---|---|---|---|---|---|
| QA-ADM-01 | Login e-mail/senha admin | F | manual | admin baseline | P0 | `docs-local/admin-test-user.md` |
| QA-ADM-02 | CRUD empresa + vaga `pending` | F+S | test:rls | admin | P0 | Nova vaga nunca `approved` direto |
| QA-ADM-03 | Lista pending + approved | S | test:rls | admin | P0 | Admin vê ambos; anon só approved |
| QA-ADM-04 | Não-admin não mantém sessão admin | S | manual | — | P0 | Candidato em `/admin` → bloqueado |
| QA-ADM-05 | Prioridade urgent + motivo | S | test:rls | 9 | P1 | RPC prioridade; CHECK motivo |
| QA-ADM-06 | Erros API na UI Admin | U | manual | — | P2 | Mensagens sem vazar stack/keys |
| QA-ADM-07 | Vagas → Área admin sem spinner de loading | U | smoke + manual | — | P0 | Staff logado: tabs visíveis &lt;500 ms; 0× “Carregando área administrativa…” |
| QA-ADM-08 | Troca Curadoria ↔ Publicar vaga | U | manual | — | P0 | Sem refetch perceptível da fila ao alternar abas (PERF-ADM-02/04) |
| QA-ADM-09 | Admin mobile: tabs + form legíveis | U | manual | — | P1 | Viewport ≤760px; alvo 44px; spacing #38 |

---

## Matriz — Segurança transversal (defensivo)

| ID | Área | Tipo | Auto | P | O que verificar |
|---|---|---|---|---|---|
| QA-SEC-01 | Segredos no repo | S | manual / grep | P0 | Sem `.env`, keys, JWT em Git |
| QA-SEC-02 | Bundle frontend | S | manual | P0 | Só `VITE_*` publishable; sem service_role |
| QA-SEC-03 | RPC SECURITY DEFINER | S | test:rls + doc | P0 | Candidato só apply/withdraw via RPC |
| QA-SEC-04 | XSS em campos renderizados | S | manual pentest | P1 | Título/descrição/stack escapados |
| QA-SEC-05 | OAuth redirect / open redirect | S | manual | P1 | Callback URLs allowlist Supabase |
| QA-SEC-06 | Rate limit / abuse apply | S | manual | P2 | Spam apply (observação; sem WAF ainda) |
| QA-SEC-07 | LGPD gate produção | S | doc | P0 | Seis controles — inventário P-01–P-21 |

**Pós Sprint 7 (Resend):** adicionar QA-SEC-10..12 (template e-mail, vazamento API key, SSRF webhook).

---

## Mapeamento `test:rls` → matriz

| Cenário RLS | IDs QA relacionados |
|---|---|
| 1 — anon | QA-ANON-01, 03, 06 |
| 2 — candidate | QA-CAND-11, 12; QA-CUR-09 |
| admin baseline | QA-ADM-01..03 |
| admin perf/nav | QA-ADM-07..09 |
| 3 — curator review | QA-CUR-01, 02 |
| 4 — self/duplicate | QA-CUR-03, 04 |
| 5 — quorum approve | QA-CUR-05 |
| 6 — tie | QA-CUR-06 |
| 7 — moderation | QA-MOD-01, 02 |
| 8 — resubmit | QA-CUR-08 |
| 9 — priority | QA-ADM-05 |
| 10 — apply happy | QA-CAND-03 |
| 11 — apply blocked | QA-CAND-04, 05 |
| 12 — withdraw | QA-CAND-06, 07 |
| 13 — profile role (F-019) | QA-ADM-02, QA-CAND-12 |

---

## Agentes e modelos recomendados (evitar modelo inadequado)

| Entrega | Quem executa | Ferramenta | Modelo / modo | Raciocínio | **Não usar** |
|---|---|---|---|---|---|
| **QA-SEC-01a** Execução manual checklist | **Frontend Visual QA** ou **Humano** PO/QA | Playwriter + [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp); ver [`setup-visual-qa-tools.md`](setup-visual-qa-tools.md) | Cursor Agent **standard** (não fast) | **Médio-alto** | Executor frontend declarando layout ok sem browser |
| **QA-SEC-01a** Matriz + template (este doc) | Plan Tech Lead | **Cursor** Agent ou Chat | Modelo **principal / Max / thinking** (ex.: Claude Opus/Sonnet thinking, GPT-5.x high) | **Alto** — cruzar backlog, RLS, LGPD | Fast/autocomplete (`composer-2.5-fast`, “fast” genérico) |
| **QA-SEC-01b** Rodar `test:rls` + registrar log | Executor | **Cursor** Shell subagent **ou** pwsh local | N/A (script determinístico) | Baixo | LLM para interpretar falha **sem** ler output |
| **QA-SEC-01c** Playwright E2E (3 fluxos) | Executor frontend | **Cursor** Agent | **Default sólido** ou Composer **standard** (não fast) | **Médio-alto** | Fast-only para arquitetura E2E |
| **QA-SEC-01d** Revisão segurança código | Security reviewer | **Cursor** subagent `security-review` | Herda modelo **forte** da sessão | **Alto** | `composer-2.5-fast`, modelos “medium-fast” |
| **QA-SEC-01d** Pentest exploratório homolog | Humano + Plan | **Cursor** Agent (modo Plan/Ask) + ferramentas manuais (Browser, ZAP opcional) | **Alto** | **Alto** | Automatizar pentest só com fast model |
| **QA-SEC-01e** Assessment consolidado | Plan Tech Lead | **Cursor** Agent | **Alto** (síntese findings → backlog) | **Alto** | Fast para priorização de severidade |
| Scripts repetitivos (grep segredos, npm audit) | Executor | **Cursor** Shell **ou** **Codex CLI** | N/A / modelo mínimo OK | Baixo | — |

### Codex CLI vs Cursor CLI

| Critério | **Cursor CLI / IDE Agent** | **Codex CLI** |
|---|---|---|
| Melhor para | Docs QA, revisão código, E2E, PRs, `security-review`, explorar repo | Tarefas scriptáveis, batch, integração CI futura |
| QA funcional manual | Ruim sozinho (sem browser humano) | Ruim sozinho |
| `test:rls` | Shell local/subagent | Pode rodar se repo + env configurados |
| Pentest / threat model | Plan + security-review (**modelo forte**) | Não substitui; no máximo auxilia scripts |
| Regra prática | **Planejar e documentar QA → Cursor (raciocínio alto)** | **Automatizar comandos → Codex ou Shell (sem LLM ou LLM mínimo)** |

**Regra de ouro:** qualquer tarefa que **prioriza severidade**, **interpreta RLS/LGPD** ou **define escopo de pentest** → **raciocínio alto**, nunca tier “fast”.

**Papéis:** Plan publica ONE-LINER (com **`Função / Agente`** obrigatório) e revisa; **Executor executa** comandos e preenche evidências. Plan **não** roda baseline QA — ver [`contributing.md`](contributing.md) § Papéis Plan vs Executor e § Handoff ONE-LINER (regra de ouro — função do executor).

---

## Próximo passo (QA-SEC-01a execução)

1. Human: garantir `docs-local/*-test-user.md` + `.env.local` (GDG-JOBS-SENAI).
2. Rodar baseline + `pnpm test:rls`; anotar falhas.
3. Percorrer matriz **P0** manual (anon + candidato + 1 curador + admin).
4. Plan preenche [`qa-security-assessment.md`](qa-security-assessment.md) com findings.

**Paralelo:** C-05 (Resend) e QA-SEC-01 Fase 1 não se bloqueiam.
