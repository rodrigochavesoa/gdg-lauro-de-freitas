# Sprint 09 — import ClickUp (Done)

Colar cada bloco como **task** na List `Sprint 09 (set/2026)`. Status: **Done**. Preencher custom fields após criar (IDs `CU-xxx` virão do ClickUp).

Depois, publicar a **Sprint Note** no final deste arquivo.

---

## Task 1

**Título:** Banner de eventos padronizado + CTA portal logado

**Status:** Done

| Campo | Valor |
|---|---|
| História ID | `UX-EVENTOS-BANNER-01` + follow-up portal #79 |
| PR | `#80` |
| Veredito Plan | APROVADO |
| Prioridade | P1 |

**Descrição (humano):**

- Landings `/eventos/:slug` com banner no tamanho certo (720px / 38vh)
- Candidato/staff logado vê atalhos úteis no portal (`/`)

**Aceite:**

- DevFest cover; DevOpsDays contain
- `PortalMemberCta` para perfil completo/incompleto/staff
- Testes verdes

**Comentário pós-merge:**

```text
Usuário vê banners de evento proporcionais e, logado, CTA claro no portal. PR #80 em main.
```

**GitHub:** https://github.com/rodrigochavesoa/gdg-lauro-de-freitas/pull/80

---

## Task 2

**Título:** Voltar do detalhe da vaga para minhas candidaturas (não portal)

**Status:** Done

| Campo | Valor |
|---|---|
| História ID | `UX-NAV-01` |
| PR | `#81` |
| Veredito Plan | APROVADO |
| Prioridade | P0 |

**Descrição (humano):**

- Quem abre vaga a partir de **Minhas candidaturas** volta para lá, não para o portal

**Aceite:**

- `state.from` em links; fallback `/vagas`
- Label contextual no botão voltar
- Smoke + testes

**Comentário pós-merge:**

```text
Navegação contextual no detalhe da vaga; fim do “voltar” cair no portal por engano. PR #81 em main.
```

**GitHub:** https://github.com/rodrigochavesoa/gdg-lauro-de-freitas/pull/81

---

## Task 3

**Título:** Repositório público enxuto (docs operacionais locais)

**Status:** Done

| Campo | Valor |
|---|---|
| História ID | `GOV-REPO-01` |
| PR | `#82` |
| Veredito Plan | APROVADO COM RESSALVAS |
| Prioridade | P1 |

**Descrição (humano):**

- Quem clona vê só README, SETUP, CONTRIBUTING, LICENSE
- Backlog/QA/agentes ficam em `docs-local/` (máquina do mantenedor)

**Aceite:**

- `docs/` removido do Git
- `public/readme/` para imagens do README
- Clone limpo: test + build verdes

**Comentário pós-merge:**

```text
Repo público legível para novos contribuidores; operação do time continua local. PR #82 em main. Ressalvas F1–F3 no corpo do PR.
```

**GitHub:** https://github.com/rodrigochavesoa/gdg-lauro-de-freitas/pull/82

---

## Task 4

**Título:** Evento abre no topo (sem scroll invertido)

**Status:** Done

| Campo | Valor |
|---|---|
| História ID | `UX-EVENTOS-SCROLL-01` |
| PR | `#83` |
| Veredito Plan | APROVADO |
| Prioridade | P0 |

**Descrição (humano):**

- Ao clicar **Ver evento**, a página mostra o banner primeiro, não o rodapé

**Aceite:**

- `ScrollToTop` global + `history.scrollRestoration = manual`
- Testes 151/151

**Comentário pós-merge:**

```text
Landings de evento abrem no topo; benefício em todas as rotas SPA. PR #83 em main.
```

**GitHub:** https://github.com/rodrigochavesoa/gdg-lauro-de-freitas/pull/83

---

## Task 5 (Ops — Blocked)

**Título:** C-05 — Resend / domínio newsletter

**Status:** Blocked

| Campo | Valor |
|---|---|
| História ID | `C-05` |
| PR | — |
| Veredito Plan | — |
| Prioridade | P0 |

**Descrição:** Credenciais e domínio para captura real `/newsletter`. Bloqueia S7-NEWSLETTER-01.

**Bloqueio:** Humano PO — credenciais em `docs-local/` (nunca no Git).

---

## Sprint Note — Sprint 09 (colar na List)

```md
## Sprint 09 — resumo (set/2026)

### Entregue

- Banner eventos + CTA portal logado (#80)
- Voltar contextual minhas candidaturas → detalhe vaga (#81)
- Repo público enxuto; docs operacionais só local (#82)
- Scroll ao topo nas landings de evento (#83)

### Pendente PO

- Preview GitHub das imagens `public/readme/*.png` no README
- C-05 Resend (task Blocked)

### Próxima sprint

- Newsletter real (após C-05)
- Visual QA DS-05 eventos (se PO pedir)

### CI / qualidade

- Testes: 151/151 após #83
- main: a2dd041
```
