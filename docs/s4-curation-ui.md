# S4-02 — Fila de curadoria (UI)

**História:** S4-02. Contrato: [`decisions-curation-v1.md`](decisions-curation-v1.md). Schema: [`s4-curation-flow.md`](s4-curation-flow.md).

A UI reutiliza o shell Admin (DS-06 — [`design-system-communication.md`](design-system-communication.md)): botões `primary`/`ghost`/`outline`, `job-form`, `form-section`, badges `featured`, `checkline`. Sem tela nova em `App.jsx`. Staff entra em **Área admin** (`/admin`) — candidatos anônimos veem form de login staff.

## Navegação Admin (pós #37–#45)

| Breakpoint | Navegação | Notas |
|---|---|---|
| Todos | Abas `.admin-tabs`: **Curadoria** · **Publicar vaga** (só `admin`) | Única nav de seção; **sem sidebar** |
| ≤760px | Mesmas abas; form e listas com padding mobile (#38) | Sidebar removida (#39) |

- **Admin** logado: aba default **Publicar vaga** (`section="jobs"`).
- **Curador / moderador:** aba default **Curadoria**.
- Card de perfil duplicado removido da fila (#39 — F-016).

## Performance (PERF-ADM-02 / #41, PERF-ADM-03 / #43, PERF-ADM-04 / #44)

| Cenário | Comportamento |
|---|---|
| Remount `/admin` (staff com snapshot) | Tabs no 1º paint; **sem** `"Carregando área administrativa…"`; `auth.profile` reutilizado (#43) |
| Admin na aba Publicar vaga | `CurationQueue` **não monta** até 1ª visita à aba Curadoria (#44) |
| Troca Curadoria ↔ Publicar vaga | Fila permanece montada com `hidden` — sem refetch ao alternar (#41) |
| Medição local | `node scripts/measure-admin-nav.mjs` — T1 tabs ~84 ms · spinner 0/5 |

## Onde está o código

| Arquivo | Papel |
|---|---|
| `src/features/curation/curation-api.js` | Único adaptador Supabase: `submit_curation_review`, `resubmit_job_for_curation`, `set_job_curation_priority`, fila, Realtime |
| `src/features/curation/CurationQueue.jsx` | UI e estado; **não** importa o client |
| `src/features/curation/rubric.js` | Códigos D-04 |
| `src/features/curation/curation-queue.js` | `urgent` antes de `normal`; empate via ids de `jobs_needing_moderation` |
| `src/Admin.jsx` | Login staff, abas, mount tardio da fila, CRUD vagas (admin) |

## Comportamento

- Fila: `jobs.status = pending`, urgente primeiro, depois mais recentes.
- Empate: badge Moderação quando o id está em `jobs_needing_moderation`.
- Parecer: rádio de rubrica obrigatório + aprovar/rejeitar; comentário opcional.
- Admin: urgente com motivo; reenvio de `rejected` (nova `curation_round`); listas **Aguardando curadoria** / **Vagas publicadas** separadas (#40 — F-017).
- Realtime: canal `postgres_changes` em `public.jobs`; `removeChannel` no unmount.
- Mobile: abas `admin-tabs` com alvo de 44px; teclado via `focus-visible` já global.

Capturas: [`docs/assets/s4-curation-desktop.png`](assets/s4-curation-desktop.png), [`docs/assets/s4-curation-mobile.png`](assets/s4-curation-mobile.png).

## Homologação manual

| ID | Critério |
|---|---|
| QA-ADM-07 | Vagas → Área admin: tabs instantâneas, sem spinner |
| QA-ADM-08 | Troca de abas sem regressão de fila |
| QA-ADM-09 | Layout mobile legível |

Ver [`qa-test-plan-homolog.md`](qa-test-plan-homolog.md).

## Fora desta entrega

ARQ-01, OAuth staff, migration nova, TypeScript, Tailwind/shadcn, Gemini, Resend.
