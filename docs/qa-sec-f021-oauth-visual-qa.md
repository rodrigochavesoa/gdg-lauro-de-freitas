# F-021 / QA-SEC-05 — Homolog Visual QA (OAuth callback)

**Data:** 2026-09-08 · **Branch:** `docs/qa-sec-f021-oauth-callback-evidence`  
**URL app:** `http://127.0.0.1:5173` · **Supabase:** `pcdfxnfhgdmzmcmlhxuv.supabase.co`  
**Ferramentas:** Playwriter 0.5.0 (Chrome do usuário, Caso A completo) · Playwright (login light/dark + probe HTTP)  
**Sem JWT/senha/e-mail neste doc.**

Evidências: [`docs/assets/qa-sec-f021/`](assets/qa-sec-f021/) · [`probe-log.json`](assets/qa-sec-f021/probe-log.json)

## Resumo

O fluxo **legítimo** (Caso A) completa o callback Google e aterrissa em `http://127.0.0.1:5173/` com sessão ativa (Header: avatar, **Sair**, **Minhas candidaturas**). Light e dark via ThemeToggle. O fluxo **malicioso** (Caso B) com `redirectTo=https://gdgjobs-f021-attacker.invalid/` **não** envia o browser ao domínio atacante: o preflight `GET /auth/v1/authorize` responde **302** para `accounts.google.com` com `redirect_uri` **fixo** no callback Supabase; o `GET /auth/v1/callback` sem `code` responde **303** para o Site URL GoTrue `http://localhost:3000` (`invalid_request` / state missing) — **nunca** para `gdgjobs-f021-attacker.invalid`.

## Achados

| ID | Sev | QA ref | Evidência | Correção sugerida |
|---|---|---|---|---|
| — | — | QA-SEC-05 | Open redirect para origem externa **não** reproduzido no callback | — |
| F-021-R1 | Info | QA-SEC-05 | Site URL GoTrue no callback de erro = `http://localhost:3000` (docs homolog citam `:5173`) | Humano: Authentication → URL Configuration alinhar Site URL / Additional Redirect URLs a `http://127.0.0.1:5173` e `http://localhost:5173` |

## Temas

- Light: OK — login DS-06 e home pós-callback com sessão  
- Dark: OK — ThemeToggle Escuro na home logada (`data-theme` via toggle)

## Console / rede

| Passo | HTTP | Location host | Notas |
|---|---|---|---|
| authorize `redirect_to=http://127.0.0.1:5173/` | 302 | `accounts.google.com` | `redirect_uri` = `…supabase.co/auth/v1/callback` |
| authorize `redirect_to=https://gdgjobs-f021-attacker.invalid/` | 302 | `accounts.google.com` | Atacante só no query `redirect_to`; **não** no hop do browser |
| callback sem code (legítimo ou atacante) | 303 | `localhost:3000` | Erro `OAuth state parameter missing`; **não** vai ao atacante |
| Caso A pós-Google (Playwriter) | — | `127.0.0.1:5173` path `/` | Sessão ativa |

Preflight 302 “aceitando” `redirect_to` externo (achado 01d) é o comportamento GoTrue esperado: o 1º hop é sempre Google + callback Supabase. A allowlist vale no **callback**, não no authorize.

## Checklist ONE-LINER

| Critério | Resultado | Evidência |
|---|---|---|
| Caso A: Google → `http://127.0.0.1:5173/` (ou rota pós-auth) + sessão | **Pass** | URL final `/` · Sair/avatar · [`A-callback-home-light-1280x720.png`](assets/qa-sec-f021/A-callback-home-light-1280x720.png) · dark [`A-callback-home-dark-1280x720.png`](assets/qa-sec-f021/A-callback-home-dark-1280x720.png) |
| Caso A light + dark | **Pass** | Login [`A-login-light-1280x720.png`](assets/qa-sec-f021/A-login-light-1280x720.png) · [`A-login-dark-1280x720.png`](assets/qa-sec-f021/A-login-dark-1280x720.png) + home acima |
| Caso B: URL final ≠ atacante | **Pass** | 303 → `localhost:3000` · [`B-callback-final-headers-1280x720.png`](assets/qa-sec-f021/B-callback-final-headers-1280x720.png) · preflight Google [`B-authorize-attacker-preflight-1280x720.png`](assets/qa-sec-f021/B-authorize-attacker-preflight-1280x720.png) |
| ≥4 screenshots | **Pass** | Pasta `docs/assets/qa-sec-f021/` |

## Recomendação Plan

**APROVADO homolog visual / QA-SEC-05 Pass homolog** — F-021 deixa de ser inconclusivo neste ambiente: callback completo (Caso A) e probe de redirect malicioso (Caso B) não resultam em open redirect.

**Residual (não bloqueia homolog):** alinhar Site URL no Dashboard (`localhost:3000` vs app `:5173`) e manter Additional Redirect URLs **sem** wildcard em preview/prod (humano). Sem alteração de `auth-api.js`. Sem push deste agente até Sim Plan.
