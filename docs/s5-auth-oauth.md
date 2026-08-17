# S5-01 — Google OAuth do candidato (homologação)

**História:** S5-01 / ARQ-01c. Contrato de perfil mínimo: D-01 em [`decisions-curation-v1.md`](decisions-curation-v1.md). Inventário: P-05 e P-06 em [`lgpd-data-inventory.md`](lgpd-data-inventory.md) — **base legal = DPO**, não rotular o cadastro como consentimento.

Ambiente: projeto Supabase de **teste**. Sem `service_role` no browser. Frontend só com `VITE_SUPABASE_URL` + chave publishable (já em `.env.local`, gitignored).

## O que o código faz

| Peça | Papel |
|---|---|
| `src/features/auth/auth-api.js` | OAuth Google, sessão, `ensureProfileRow`, persistência D-01 |
| `Login.jsx` / `Header.jsx` | UI; **não** importam o client Supabase |
| `Onboarding.jsx` | Completude D-01; montado pelo shell se o candidato ainda não preencheu |

`profiles.role` **não** é enviado pelo browser. Insert usa só `id` + `full_name`; o default do banco é `candidate`. Staff (admin/curator/moderator) continua no e-mail/senha de [`Admin.jsx`](../src/Admin.jsx).

Sessão: `persistSession` + `autoRefreshToken` + `detectSessionInUrl` no client do browser. O refresh da página restaura o JWT no `localStorage` do domínio local.

### `profiles.preferences` (homologação)

```json
{
  "experience_level": "junior",
  "work_model": "remote",
  "location": "Brasil · Remoto",
  "linkedin": null,
  "github": null,
  "cv_url": null
}
```

`skills` fica em `profiles.skills` (`text[]`). Bio em `profiles.bio`. Currículo nesta entrega é **URL**, sem Storage.

## Redirect URLs (humano no painel)

Não inventar URL de produção. Homologação local:

| Onde | Valor |
|---|---|
| Google Cloud — Authorized redirect URI | `https://<PROJECT_REF>.supabase.co/auth/v1/callback` |
| Supabase Auth — Site URL | `http://localhost:5173` |
| Supabase Auth — Additional Redirect URLs | `http://localhost:5173`, `http://localhost:5173/`, `http://127.0.0.1:5173` |
| Código (`redirectTo`) | `window.location.origin + '/'` (ex.: `http://localhost:5173/`) |

O **Client ID e secret** do Google ficam **só no painel** Supabase (Authentication → Providers → Google). Nunca no Git, nunca em `VITE_*`.

Checklist humano (projeto de teste):

1. Provider Google já ligado (esta história assume que sim).
2. Conferir Site URL = `http://localhost:5173`.
3. Conferir callback no console Google = `https://<PROJECT_REF>.supabase.co/auth/v1/callback`.
4. Contas de teste / e-mails reais de homologação só em `docs-local/` (gitignored).

Capturas da tela Login reutilizada (DS-06): [`docs/assets/s5-auth-desktop.png`](assets/s5-auth-desktop.png), [`docs/assets/s5-auth-mobile.png`](assets/s5-auth-mobile.png).

Fora de escopo: candidatura 1 clique, Router, consentimento granular, exportação/exclusão, Gemini, Resend, deploy público, mudança de RLS de curadoria.
