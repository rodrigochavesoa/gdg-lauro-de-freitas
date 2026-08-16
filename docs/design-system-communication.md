# GDGJobs — Design System e Comunicação

## Decisão de referência visual

Enquanto a equipe não possui acesso à biblioteca de componentes oficial no Figma, o MVP do GDGJobs seguirá como **referência visual temporária** o site [DevFest Lauro de Freitas](https://devfestlauro.com.br/).

Essa referência não substitui uma biblioteca oficial de Design System e não autoriza copiar ativos, código ou conteúdo do site. Ela orienta os princípios visuais do MVP: base clara, identidade GDG, uso pontual das cores Google/GDG, CTAs arredondados com alto contraste, cards informativos e hierarquia tipográfica objetiva.

## Fonte operacional de componentes — obrigatória

A pasta local [design_system_web](C:\Colab_Developer\gdg-senai\docs\design-system\referencias\design_system_web) é a referência operacional prioritária para os componentes do GDGJobs durante o MVP. Ela contém escalas de cores, tipografia e especificações visuais para componentes web.

**Regra de ouro:** antes de criar, alterar ou reutilizar qualquer elemento visual, a pessoa ou agente responsável deve consultar esta documentação e a referência correspondente na pasta `design_system_web`. É proibido recriar um componente existente com espaçamentos, cores, variantes ou comportamentos arbitrários.

Quando houver conflito entre as referências:

1. A pasta `design_system_web` prevalece para tokens, estados e anatomia de componentes.
2. O DevFest Lauro prevalece como inspiração de composição e identidade temporária GDG.
3. A futura biblioteca oficial no Figma prevalecerá sobre ambas após aprovação da equipe de design.

### Catálogo obrigatório de consulta

| Grupo | Referências disponíveis |
|---|---|
| Ações e feedback | Action Sheet, Alert, Button, Loader, Pop-Up, Progress Bar, Tooltip |
| Navegação | Breadcrumbs, Context Menu, Dropdown, Navbar Bottom, Navbar Top, Pagination, Page Control, Stepper, Tab |
| Entrada e seleção | Checkbox, Input, Radio, Toggle |
| Conteúdo e identidade | Avatar, Badge & Chip, Card, List |
| Fundações | Colors, Typography |

Antes de criar uma nova variação, verificar nesta ordem: **o componente já existe? → a variante atende ao caso? → é possível compor componentes existentes? → somente então propor uma nova variante para revisão de design.**

## Estado atual

- O protótipo possui variáveis CSS globais, layout responsivo, cards, botões, filtros e feedback visual.
- A DS-02 foi aplicada ao protótipo: a antiga paleta laranja/roxa foi substituída pelos tokens temporários aprovados de azul, neutros e estados semânticos. A tipografia usa uma escala global em `src/styles.css`.
- As cores das logos de empresas no conteúdo demonstrativo são dados de marca isolados; não fazem parte dos tokens de interface.
- A identidade visual inclui o símbolo GDG em SVG, favicon/PWA para web e mobile, ilustração de Login com opacidade controlada e ícone oficial do Google no fluxo de acesso.
- A tela de Login usa a marca dinâmica `gdg-jobs-dynamic-brand.svg`; a animação respeita `prefers-reduced-motion`. O menu mobile possui fluxo de foco acessível e o rodapé mantém a assinatura da comunidade em telas pequenas.
- DS-06 está documentada e aplicada como regra de trabalho do agente; sua evidência formal em PR/CI permanece pendente enquanto não houver repositório Git e pipeline.
- A equipe não possui acesso ao Figma nem aos componentes oficiais; logo, não há biblioteca, tokens aprovados ou revisão de design em produção.

## Regras do MVP

### Tokens provisórios

Os tokens devem ser centralizados e aplicados por variável, nunca codificados repetidamente nos componentes.

| Uso | Token | Valor temporário aprovado |
|---|---|---|
| Ação primária | `color-action-primary` | `#2563EB` |
| Hover da ação | `color-action-primary-hover` | `#1D4ED8` |
| Fundo principal | `color-surface` | `#FFFFFF` |
| Fundo sutil | `color-surface-subtle` | `#F8FAFC` |
| Texto principal | `color-text` | `#18181B` |
| Texto secundário | `color-text-muted` | `#71717A` |
| Borda | `color-border` | `#E4E4E7` |
| Sucesso | `color-feedback-success` | `#16A34A` |
| Alerta | `color-feedback-warning` | `#F59E0B` |
| Erro | `color-feedback-danger` | `#E11D48` |

Os acentos institucionais são `#4285F4` (azul GDG), `#EA4335` (vermelho GDG), `#FBBC04` (amarelo GDG) e `#34A853` (verde GDG). Eles são destinados a ilustrações, badges, detalhes e elementos institucionais; não substituem os tokens semânticos nem a ação primária.

| Categoria | Diretriz para o MVP |
|---|---|
| Cores de marca | `#2563EB` é a única cor primária de interação. Usar os quatro acentos GDG/Google apenas de forma moderada em ilustrações, badges, detalhes e elementos institucionais. |
| Cor semântica | Definir tokens separados para ação primária, sucesso, alerta, erro, informação, foco, texto, borda e fundo. |
| Tipografia | Uma família sans-serif legível, escala tipográfica definida para título, subtítulo, corpo, legenda e rótulo. |
| Espaçamento | Escala única de espaçamentos e raios de borda; evitar valores arbitrários por tela. |
| Elevação | Poucos níveis de sombra, aplicados consistentemente em cards, menus e modais. |
| Acessibilidade | Contraste mínimo adequado, foco visível, navegação por teclado, texto alternativo e estados não dependentes apenas de cor. |

### Escalas da referência local

- A referência dispõe de escalas `50` a `900` para **Primary, Grey, Green/Success, Red/Danger, Yellow/Warning e Blue/Info**, além de escalas de preto e branco por opacidade.
- Todo token deve apontar para uma escala semântica. Exemplo: `color-action-primary`, `color-feedback-success` e `color-text-muted`; componentes não recebem uma cor hexadecimal isolada.
- Os tons exatos devem ser extraídos/aprovados a partir de `Colors.png` antes de codificação. Os valores temporários definidos para o MVP não substituem essa escala.
- A tipografia de referência inclui H1 a H5, subtítulos, corpo, captions e labels, com escalas e line-heights definidos em `Typography.png`. Não criar tamanhos fora dessa escala sem revisão.

### Componentes mínimos

| Componente | Estados obrigatórios |
|---|---|
| Botão | padrão, hover, foco, carregando, desabilitado e erro quando aplicável |
| Campo e filtro | rótulo, ajuda, foco, erro, selecionado e vazio |
| Card de vaga | padrão, destaque, carregando e sem resultado |
| Badge de status | pendente, aprovada, arquivada, sucesso, alerta e erro |
| Feedback | loading, vazio, sucesso, erro e ação de recuperação |
| Navegação | desktop, mobile e item ativo |

## Comunicação de produto

- Usar linguagem direta, inclusiva e orientada à ação.
- Explicar decisões de matching com critérios compreensíveis, por exemplo: “Compatível com React e nível Pleno”.
- Informar claramente status de curadoria, candidatura, consentimento e processamento por IA.
- Padronizar mensagens de sucesso, erro e ausência de resultados em Site, Jobs e demais superfícies do produto.
- Todo texto de LGPD, consentimento e exclusão de dados deve ser claro, específico e revisado pelos responsáveis de privacidade.

## Produção — dependência de Figma e revisão colaborativa

Antes do lançamento, a equipe de design deve:

1. Disponibilizar acesso ao arquivo e à biblioteca de componentes no Figma.
2. Validar tokens oficiais de cor, tipografia, ícones, espaçamento e acessibilidade.
3. Criar ou aprovar variantes de componentes e seus estados.
4. Revisar as telas de Home, Detalhe da Vaga, Login, Perfil, Candidaturas e Admin.
5. Realizar handoff para desenvolvimento e aprovar a implementação visual em ambiente de homologação.

## Backlog e critérios de aceite

| ID | Entrega | Prioridade | Critério de aceite |
|---|---|---:|---|
| DS-01 | Auditoria do protótipo contra a referência DevFest Lauro | P0 — parcial | Referência consultada e diferenças principais corrigidas; falta inventário formal aprovado. |
| DS-02 | Tokens globais e atualização da interface do MVP | P0 — implementada | Home, detalhes, Login e Admin usam tokens consistentes; compilação validada. A revisão visual formal permanece em DS-05. |
| DS-03 | Definir o escopo de “Language” na entrega cross-platform | P1 | Product Owner especifica se significa idioma, landing page ou outro canal. |
| DS-04 | Biblioteca oficial no Figma e revisão colaborativa | P1 | Componentes, variantes e tokens aprovados pela equipe de design. |
| DS-05 | QA visual e de acessibilidade | P1 | Fluxos críticos validados em desktop/mobile, teclado e leitor de tela. |
| DS-06 | Consulta obrigatória ao catálogo antes de criar componentes | P0 — documentada | Regra obrigatória registrada; PRs de interface devem citá-la quando o repositório e CI estiverem configurados. |

## Gate de produção

O produto não deve ser considerado visualmente aprovado para produção enquanto DS-02, DS-04 e DS-05 não tiverem evidências de revisão e aceite da equipe de design.
