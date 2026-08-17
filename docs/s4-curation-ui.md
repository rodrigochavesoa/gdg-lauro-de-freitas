# S4-02 — Fila de curadoria (UI)

**História:** S4-02. Contrato: [`decisions-curation-v1.md`](decisions-curation-v1.md). Schema: [`s4-curation-flow.md`](s4-curation-flow.md).

A UI reutiliza o shell Admin (DS-06 — [`design-system-communication.md`](design-system-communication.md)): botões `primary`/`ghost`/`outline`, `job-form`, `form-section`, badges `featured`, `checkline`. Sem tela nova em `App.jsx`. Curadores entram em **Comunidade / Para empresas** (mesmo `Admin`).

## Onde está o código

| Arquivo | Papel |
|---|---|
| `src/features/curation/curation-api.js` | Único adaptador Supabase: `submit_curation_review`, `resubmit_job_for_curation`, `set_job_curation_priority`, fila, Realtime |
| `src/features/curation/CurationQueue.jsx` | UI e estado; **não** importa o client |
| `src/features/curation/rubric.js` | Códigos D-04 |
| `src/features/curation/curation-queue.js` | `urgent` antes de `normal`; empate via ids de `jobs_needing_moderation` |
| `src/Admin.jsx` | Login de staff (`curator` / `moderator` / `admin`) e aba Curadoria |

## Comportamento

- Fila: `jobs.status = pending`, urgente primeiro, depois mais recentes.
- Empate: badge Moderação quando o id está em `jobs_needing_moderation`.
- Parecer: rádio de rubrica obrigatório + aprovar/rejeitar; comentário opcional.
- Admin: urgente com motivo; reenvio de `rejected` (nova `curation_round`).
- Realtime: canal `postgres_changes` em `public.jobs`; `removeChannel` no unmount.
- Mobile: sidebar Admin some abaixo de 760px; abas `admin-tabs` com alvo de 44px; teclado via `focus-visible` já global.

Capturas: [`docs/assets/s4-curation-desktop.png`](assets/s4-curation-desktop.png), [`docs/assets/s4-curation-mobile.png`](assets/s4-curation-mobile.png).

## Fora desta entrega

ARQ-01, OAuth, migration nova, extração Home/Login/Header, Router, TypeScript, Tailwind/shadcn, Gemini, Resend.
