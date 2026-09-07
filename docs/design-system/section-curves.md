# DS-07 — Transições curvas entre seções

**Status:** vigente no MVP  
**Audiência:** agente com perfil Frontend / Executor de UI, e qualquer PR que altere layout  
**Relação:** complemento obrigatório de [`docs/design-system-communication.md`](../design-system-communication.md) (DS-06)

Este documento é a **fonte da verdade** para o perfil visual de juntas entre regiões da interface (hero ↔ conteúdo, painel ↔ formulário, faixa pontilhada ↔ `surface`). Não descreve tokens de cor, tipografia ou componentes de formulário — esses permanecem na DS-06 e em `docs/design-system/referencias/design_system_web`.

---

## 1. Princípio de produto

O GDGJobs **não** trata transições de seção como uma linha reta (`border-bottom`, `border-right` ou um corte horizontal de fundo). O perfil do site é **ondulado**: a superfície de destino “entra” na superfície de origem com uma onda SVG estável.

| Fazer | Não fazer |
|---|---|
| Reutilizar o `path` canônico e as classes já existentes | Inventar um `d` novo, `clip-path` em elipse ou raio isolado por tela |
| Pintar a onda com `fill: var(--color-surface)` (ou o token da superfície **destino**) | Hexadecimal, `currentColor` ou `stroke` visível na onda |
| Sobrepor a curva à junta, com conteúdo (`z-index`) acima e `pointer-events: none` | Cobrir busca, “Populares”, títulos ou CTAs |
| `aria-hidden="true"` e `focusable="false"` no SVG decorativo | Expor a onda a leitores de tela |
| Estender o path ~8 unidades além do `viewBox` (costura de 1px) | Alinhar o path exatamente em `M0` / `L1440` nas bordas |

Antes de desenhar uma seção nova, aplicar a regra de ouro da DS-06: **o recorte já existe? → a variante atende? → dá para compor? → só então propor variação para revisão de design.**

---

## 2. Inventário canônico (não recriar)

| Recorte | Onde vive | Quando reutilizar |
|---|---|---|
| Onda **inferior** (junta horizontal) | `Home.jsx` → `.home-divider__curve`; `Login.jsx` → `.login-panel__curve--bottom` | Qualquer passagem de fundo pontilhado / `surface-subtle` para `surface` **abaixo** |
| Onda **lateral direita** (junta vertical) | `Login.jsx` → `.login-panel__curve--right` | Qualquer coluna pontilhada à **esquerda** de uma coluna `surface` (login, onboarding, split marketing) |
| Divisor + avatar da home | `.home-divider` + `.home-divider__avatar` | **Somente a home.** Não copiar o avatar para Login, Admin ou detalhe |
| Estilos | `src/styles.css` (bloco DS-07 ao final do arquivo) | Ajustar media queries existentes; não duplicar o bloco em outro CSS |

**Extração para `shared/ui`:** permitida **somente** quando uma **terceira** tela precisar da mesma onda, em linha com ARQ-01 (`shared/ui` após uso em duas features ou aprovação explícita). Até lá, copiar o SVG canônico com as **mesmas** classes/paths, sem “melhorar” a geometria.

---

## 3. Geometria canônica

Valores abaixo são o contrato. Alterá-los exige nota neste documento e evidência visual (desktop, iPad ≤1024px, mobile ≤760px).

### 3.1 Onda inferior (horizontal)

| Propriedade | Valor |
|---|---|
| `viewBox` | `0 0 1440 120` |
| `preserveAspectRatio` | `none` |
| `fill` | `var(--color-surface)` |
| `stroke` | `none` |
| `d` | `M-8 52 C 180 118 380 14 560 64 C 740 112 920 8 1100 58 C 1240 96 1360 22 1448 48 L 1448 128 L -8 128 Z` |

Não substituir por `clip-path: ellipse(...)`. Elipse com raio ≥ altura da faixa **achata** o topo e a junta volta a parecer reta.

### 3.2 Onda lateral direita (vertical)

| Propriedade | Valor |
|---|---|
| `viewBox` | `0 0 80 800` |
| `preserveAspectRatio` | `none` |
| `fill` | `var(--color-surface)` |
| `stroke` | `none` |
| `d` | `M 30 0 C 72 140 6 260 44 400 C 78 540 10 660 36 800 L 80 800 L 80 0 Z` |

A onda preenche o **lado direito** da caixa; a borda esquerda do path é a curva visível.

---

## 4. Tokens e empilhamento

| Papel | Token / regra |
|---|---|
| Superfície de origem (hero, painel login) | `--color-surface-subtle` + malha `radial-gradient(var(--color-primary-100) 1px, transparent 1px)` / `background-size: 16px 16px` |
| Superfície de destino (lista, formulário, onda) | `--color-surface` |
| Header sobre a home/login | `body:has(.hero) .topbar` e `body:has(.login-page) .topbar` → `border-bottom: none` |
| Conteúdo da origem | `position: relative; z-index: 1` ou `4` (hero) — **sempre acima** da onda |
| Onda | `z-index: 0` (login) ou `2` (divisor da home); `pointer-events: none` |
| Ilustração / avatar | Decorativo; `alt=""`; nunca interceptar clique |

Tema claro/escuro: a onda **segue** `--color-surface`. Não fixar `#fff`.

---

## 5. Home — divisor `.home-divider`

Referência de implementação: `src/features/catalog/Home.jsx` + bloco `.home-divider` em `src/styles.css`.

| Breakpoint | Altura do divisor | `margin-top` | `padding-bottom` do `.hero` | Padding do `.jobs-layout` seguinte |
|---|---:|---:|---:|---:|
| Desktop (>1024px) | `120px` | `-108px` | `120px` | `52px` |
| iPad (≤1024px) | `112px` | `-100px` | (herda desktop) | (herda) |
| Mobile (≤760px) | `104px` | `-92px` | `108px` | `36px` |

SVG da curva: `width: calc(100% + 16px); height: 100%; margin-left: -8px` (transbordo anti-costura).

### Avatar (somente home)

| Breakpoint | Posição | Largura | `max-height` | `bottom` |
|---|---|---|---|---|
| Desktop | `left: max(16px, calc((100% - 1180px) / 2))` — **sempre à esquerda**, nunca centralizado | `min(280px, 32vw)` | `200px` | `-12px` |
| iPad | `left: 16px` | `min(220px, 34vw)` | `168px` | (herda) |
| Mobile | `left: 8px` | `min(42vw, 148px)` | `128px` | `-8px` |

Regras do avatar:

1. **Alinhado à esquerda** em todos os breakpoints.
2. **Transborda** a junta: parte sobre o pontilhado do hero, parte sobre `surface` — não “sentar” só no branco (isso recria uma divisão reta só no desenho).
3. O `padding-bottom` extra do hero reserva faixa **abaixo** de busca e “Populares”; o divisor sobe só nessa faixa (`margin-top` negativo). Texto permanece clicável (`z-index` do `.hero-content`).
4. Ativo: `public/avatar-gdgjobs.png` (recorte sem coluna preta na esquerda). Origem de design: `docs/design-system/referencias/svg-banner-login/avatar-gdgjobs.png`. Não recortar de novo sem necessidade.

---

## 6. Login — `.login-panel`

Referência: `src/features/auth/Login.jsx` + `.login-panel__curve*` em `src/styles.css`.

| Peça | Desktop / iPad | Mobile (≤760px) |
|---|---|---|
| `.login-panel__curve--right` | `width: 72px`; `top/right: 0`; `height: 100%` | `width: 48px` |
| `.login-panel__curve--bottom` | `height: 88px`; `left/bottom: 0`; `width: 100%` | `height: 72px` |
| Folga do texto | `padding-bottom: 88px` no painel | manter folga; citação some no mobile (já existente) |

`.login-page` e `.login-form` usam `background: var(--color-surface)` para a onda **fundir-se** à coluna do formulário, sem linha de grid visível.

`overflow: hidden` no painel permanece (ilustração); as SVGs ficam **dentro** da section.

---

## 7. Protocolo do agente Frontend

Obrigatório em toda história de UI (tela nova, seção nova, split, hero, onboarding, perfil público):

1. **Ler este arquivo por completo** e a DS-06 antes de escrever JSX/CSS de layout.
2. **Reutilizar** onda inferior e/ou lateral conforme a junta (horizontal, vertical ou ambas). Não criar `section` com borda reta na transição de fundos.
3. **Não** reimplementar com `border-radius` grande, `clip-path: ellipse`, ou onda “mais suave” sem revisão de design.
4. **Não** alterar tokens, copy, cards, OAuth ou filtros para “fazer a curva caber”.
5. Garantir desktop, **iPad (≤1024px)** e **mobile (≤760px)**.
6. Na PR: citar este documento **e** `docs/design-system-communication.md`; anexar capturas da junta (não só o card interno).

### Anti-padrões já observados

| Sintoma | Causa típica | Correção |
|---|---|---|
| Junta vira linha reta | `clip-path` elipse com raio ≥ altura | Voltar ao SVG canônico §3.1 |
| Risca vertical escura no tema claro | Path colado em `x=0` **ou** PNG com coluna opaca **ou** `border-right` dos filtros atravessando PNG transparente | Transbordo do path; recorte do PNG; avatar fora da coluna de filtros |
| Avatar cobre “Populares” | `margin-top` negativo demais e/ou avatar centralizado | Esquerda + padding do hero + `z-index` do conteúdo |
| Avatar “caixa” no branco | Divisor com `margin-top: 0` e avatar só na faixa `surface` | Recolocar o divisor sobre o hero (§5) |

---

## 8. Critério de aceite (PR de layout)

- [ ] Nenhuma junta maior hero/painel/lista usa apenas `border` reto como transição de fundo.
- [ ] `d`, `viewBox` e `fill` batem com §3 (ou este doc foi atualizado na mesma PR).
- [ ] Texto e controles da origem permanecem visíveis e clicáveis.
- [ ] Evidência visual: desktop, iPad e mobile.
- [ ] PR cita DS-06 e DS-07.

---

## Histórico

| Data | Nota |
|---|---|
| 2026-09-07 | Contratação inicial a partir da home (divisor + avatar) e do painel de login (ondas inferior e direita). |
