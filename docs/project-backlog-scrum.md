# GDGJobs — Backlog, Scrum e plano de entrega

## Visão do produto

**GDGJobs** é uma plataforma de vagas tech curada pela comunidade GDG, com matching progressivo e sem cobrança inicial para empresas anunciantes.

Princípios do produto:

- Curadoria antes da publicação: uma vaga só é pública depois de aprovada.
- Privacidade por padrão: perfis e candidaturas são visíveis apenas ao candidato e administradores autorizados.
- Matching explicável: critérios explícitos continuam visíveis, mesmo quando houver IA.
- Evolução por evidência: recomendação colaborativa só começa após existirem eventos de uso consentidos e em quantidade suficiente.

## Gate de aprovação — LGPD por design

**Decisão dos stakeholders:** a aprovação do GDGJobs para entrega completa ou produção depende da implementação e validação dos seis controles abaixo. Eles são requisitos mandatórios, não itens opcionais de melhoria.

| Controle obrigatório | Resultado exigido para aprovação |
|---|---|
| Consentimento granular | O usuário seleciona finalidades específicas; o sistema registra versão, data, prova e revogação do consentimento. |
| Row-Level Security | Perfis e candidaturas são isolados por usuário; as policies são aplicadas e testadas no Supabase. |
| Direitos do titular | O usuário consegue corrigir, exportar e solicitar exclusão dos seus dados por fluxo acessível. |
| Registro de operações | Há auditoria de acesso, alteração e processamento de dados pessoais, com ator, ação, data e recurso afetado. |
| Anonimização para ML | Dados enviados para treinamento, análise ou recomendação colaborativa passam por anonimização; dados pessoais não são enviados a ML sem base legal e controle definido. |
| Notificação de incidentes | Existe protocolo documentado, responsável, registro de incidentes, avaliação de risco e comunicação conforme a LGPD. |

**Regra de liberação:** enquanto qualquer controle estiver pendente, o ambiente pode ser usado apenas para desenvolvimento/homologação com dados fictícios ou devidamente autorizados. Produção exige evidências de teste e aceite do Product Owner para todos os itens.

## Estratégia de custos — protótipo e produção

### Fase 1: protótipo e homologação

**Objetivo de custo:** buscar `$0/mês`, sem promessa de disponibilidade ou capacidade para 10 mil usuários.

| Serviço | Uso permitido nesta fase | Limite operacional |
|---|---|---|
| Vercel ou Firebase Hosting | Prévia, validação visual e homologação interna | Escolher apenas uma plataforma antes do deploy público. |
| Supabase Free | Dados fictícios ou autorizados, RLS e Edge Functions em teste | Banco, Storage e egress dentro das franquias; projeto pode pausar por inatividade. |
| Gemini Free | Testes com vagas fictícias ou textos públicos, sem dados pessoais de candidatos | Não enviar perfis, currículo, e-mails ou identificadores. |
| Resend Free | Testes de template para endereços da equipe | Respeitar os limites de envio diário e mensal. |
| GitHub Free | Repositório, PRs, CI e revisão | Controlar minutos de Actions e retenção de artefatos. |

### Fase 2: produção inicial

**Princípio:** não prometer `$0/mês` com base apenas no número de usuários. O custo depende de tráfego, banco, Storage, execuções, e-mails, tokens de IA e requisitos de disponibilidade/privacidade.

| Componente | Decisão ou ação obrigatória antes da produção |
|---|---|
| Hospedagem | Confirmar Vercel ou Firebase Hosting. Caso seja Vercel, validar se o plano gratuito é elegível para a natureza do GDGJobs; caso contrário, provisionar plano comercial. |
| Supabase | Configurar projeto de produção, alertas de uso, backup, política de retenção e plano de upgrade para além das franquias. |
| Gemini | Definir modelo, região, limites, orçamento e condições de tratamento de dados. Dados pessoais não podem seguir para IA sem os controles LGPD aprovados. |
| Resend | Estimar volume de e-mails por evento, configurar domínio, SPF/DKIM/DMARC e escolher plano compatível com a projeção. |
| Observabilidade | Implementar logs, auditoria LGPD, alertas de erro/uso e responsável de plantão para incidentes. |
| Domínio | Registrar domínio, renovação e responsável financeiro. |

### Decisões pendentes de custo

| ID | Decisão | Responsável | Prazo |
|---|---|---|---|
| C-01 | Escolher hospedagem: Vercel ou Firebase Hosting. | Product Owner + Tech Lead | Sprint 1 |
| C-02 | Definir se o plano de produção pode usar Vercel Hobby ou requer plano comercial. | Tech Lead + responsável financeiro | Antes do primeiro deploy público |
| C-03 | Definir orçamento mensal, alertas de 50/80/100% e responsável por aprovar upgrade. | Product Owner + financeiro | Sprint 2 |
| C-04 | Definir política de uso do Gemini em produção, incluindo dados permitidos, limites de tokens e retenção. | DPO/privacidade + Tech Lead | Antes do Sprint 9 |
| C-05 | Definir volume de e-mails e plano Resend após estimativa de notificações. | Product Owner + Tech Lead | Antes do Sprint 7 |
| C-06 | Definir política de backup e recuperação para o banco de produção. | Tech Lead | Antes do primeiro deploy público |

### Gate financeiro de produção

O deploy público só pode ocorrer quando C-01 a C-06 estiverem decididos, houver alertas de uso configurados e o Product Owner tiver aceitado o orçamento. Caso o custo mínimo aprovado seja maior que `$0`, a previsão oficial deve ser atualizada antes do lançamento.

## Estado atual — implementado

### Protótipo de interface

- Aplicação React/Vite criada, com interface responsiva e dados simulados.
- Home com busca textual, filtros por tecnologia e nível de experiência, limpeza de filtros e estado vazio.
- Tela de detalhe da vaga com tecnologias, localidade, nível, descrição, responsabilidades e ação de candidatura.
- Candidatura com um clique simulada, incluindo confirmação visual.
- Login visual com opção de Google e e-mail; ainda não autenticado de verdade.
- Painel administrativo visual para cadastro de vaga e indicação de status pendente de curadoria.
- Estilos próprios em CSS. **Tailwind CSS e shadcn/ui ainda não foram instalados**, portanto não devem ser considerados concluídos.
- Design System provisório (DS-02) aplicado: tokens globais de azul, neutros, estados semânticos, tipografia, espaçamento, raios, sombras e foco visível.
- Identidade GDG aplicada à marca: símbolo de brackets em SVG no produto, favicon vetorial e versões PNG para navegador, iOS e PWA.
- Login refinado com ilustração SVG da referência, ícone oficial do Google e identificação “GDG Lauro de Freitas”; a ilustração é ocultada no mobile para preservar legibilidade.
- Marca dinâmica no Login com indicador “VAGAS”, respeitando `prefers-reduced-motion` para desativar animações quando solicitado pelo sistema do usuário.
- Menu hamburger funcional e acessível no mobile: abre/fecha, navega, devolve o foco ao botão de origem e não usa `aria-hidden` em elementos focados.
- Rodapé mobile preserva a assinatura da comunidade em segunda linha; metadados PWA incluem `mobile-web-app-capable` e suporte Apple legado.
- Pacotes visuais de referência em `docs/design-system/referencias/`. A cópia aninhada de `favicons_package` foi inventariada (SHA-256) e removida em S1-02; `public/` e a pasta pai permaneceram intactos. Inventário: `docs/favicons-inventory.md`.

Arquivos: `src/main.jsx` (entrada), `src/App.jsx` (protótipo), `src/lib/filter-jobs.js`, `src/styles.css` e `package.json`.

### Dados, segurança e IA preparados

- Migration com `profiles`, `companies`, `jobs` e `applications`.
- RLS para proteger perfis e candidaturas, mantendo apenas vagas aprovadas públicas.
- Proteção contra elevação indevida de papel de candidato para administrador.
- `pgvector` habilitado com coluna de embedding de 768 dimensões e índice HNSW em vagas aprovadas.
- RPC `match_jobs`: score de **70% semântico + 30% compatibilidade de stack**, com filtros explícitos de nível e modelo de trabalho.
- Edge Function `enrich-job`: enriquece descrição e requisitos da vaga usando Gemini e persiste o embedding.
- Edge Function `match-jobs`: gera embedding do perfil/busca e executa a RPC de matching.
- Roadmap registrado para V1, V2 e V3 de IA.

Arquivos: `supabase/migrations/202608150001_ai_matching.sql`, `supabase/functions/` e `docs/ml-roadmap.md`.

### Limites atuais

- Catálogo público lê vagas `approved` no Supabase de **teste** (publishable/anon). Gemini, Storage, Realtime, Resend, OAuth e deploy **não estão conectados**.
- Firebase Auth e Firebase Hosting não foram configurados.
- Não há API Routes, validação Zod ou ambiente de produção.
- Home lê vagas `approved` via Supabase (publishable/anon). Seed fictício em `supabase/migrations/202608160002_seed_fictitious_catalog.sql`. RLS do visitante: `docs/s2-catalog-rls.md`.
- **S1-01 aprovada pelo Tech Lead (2026-08-15):** ESLint 9, Vitest 3 (6 testes de busca/filtros + 1 smoke da Home), scripts `lint`/`test`/`test:watch`, `packageManager` pnpm 10.30.1, `.gitignore` e GitHub Actions (`.github/workflows/ci.yml`) com `pnpm install --frozen-lockfile`, lint, test e build. Evidência local em `pwsh`: 7 testes verdes e `vite build` ok. CI remoto ainda depende de Git/Actions. Runtime continua com `latest` — não ampliar esse padrão.

## Decisões técnicas pendentes

Antes do Sprint 1, o Product Owner e a equipe devem fechar estas escolhas:

1. **Hospedagem:** Vercel para frontend e rotas/Edge Functions, ou Firebase Hosting. A recomendação é Vercel se a aplicação evoluir para Next.js; Firebase Hosting é suficiente para um frontend Vite estático.
2. **UI:** migrar o CSS atual para Tailwind CSS e componentes shadcn/ui, como definido no escopo inicial.
3. **Curadoria:** definir quem aprova, quantos votos são necessários, prazo de análise e regra para rejeição/recadastro.

### Decisão registrada

**Autenticação aprovada: Supabase Auth com Google OAuth.** Firebase Auth não fará parte do escopo. A tabela `profiles` permanece vinculada a `auth.users`, e o Sprint 5 deverá concluir o onboarding e a autenticação real.

## Pendências de produto — resolver antes do Sprint 4

O Sprint 4 implementa curadoria e publicação. As decisões abaixo são bloqueadoras e devem ser aprovadas pelo Product Owner com os stakeholders **até o fim do Sprint 3**. Sem elas, a equipe não deve iniciar a implementação do fluxo de aprovação.

| ID | Decisão necessária | Estado atual | Responsável pela decisão |
|---|---|---|---|
| D-01 | Definir os campos obrigatórios que tornam um perfil apto à candidatura com um clique. | Parcial: há campos de perfil, mas não há regra de completude. | Product Owner + Comunidade GDG |
| D-02 | Definir participantes autorizados da curadoria: qualquer membro, usuário verificado ou grupo de moderadores. | Em aberto. | Product Owner + Comunidade GDG |
| D-03 | Definir o limiar de aprovação: quantidade de votos, quórum e prazo máximo para decisão. | Em aberto. | Product Owner + Comunidade GDG |
| D-04 | Definir o mecanismo: votação, aprovação individual ou moderação. | Em aberto. | Product Owner + Comunidade GDG |
| D-05 | Definir se um administrador pode publicar sem curadoria e em quais situações excepcionais. | Em aberto. | Product Owner |
| D-06 | Definir o tratamento de rejeição: motivo obrigatório, edição pelo admin e possibilidade de reenvio. | Em aberto. | Product Owner + Comunidade GDG |
| D-08 | Definir se a candidatura de um clique usa apenas perfil ou também currículo e carta de apresentação. | Parcial: o protótipo usa apenas perfil. | Product Owner + Empresas parceiras |
| D-09 | Definir se o candidato pode cancelar, editar ou reenviar candidatura e até quando. | Parcial: o banco prevê `withdrawn`; não há política nem interface. | Product Owner + Empresas parceiras |
| D-10 | Definir o modelo de sustentabilidade financeira, mantendo anúncio gratuito para empresas. | Em aberto. | Product Owner + Liderança GDG |

**D-07 está resolvida:** o cadastro e a edição de empresas e vagas permanecem exclusivamente administrativos no escopo atual.

### Pendências parcialmente resolvidas — fechar no fluxo planejado

| ID | Decisão já tomada | O que ainda precisa ser definido | Sprint de fechamento |
|---|---|---|---|
| P-01 | Candidaturas possuem o status `withdrawn` e o candidato pode atualizar a própria candidatura. | Permitir ou bloquear reabertura; definir prazo, limite e estados de transição. | Sprint 6 |
| P-02 | A stack é `TEXT[]` com índice GIN. | Definir gatilhos objetivos para migrar para `technologies` e `job_technologies`, como sinônimos, categorias ou relatórios. | Revisão ao fim do Sprint 8 |
| P-03 | Modalidade foi separada em `work_model`. | Decidir se `location` permanece texto livre ou será decomposta em cidade, estado e país. | Sprint 2 |
| P-04 | Há `approved_at` na vaga. | Adicionar `approved_by`, motivo de rejeição e histórico de decisões após definição da curadoria. | Sprint 4 |
| P-05 | `profiles` referencia `auth.users` do Supabase. | Configurar Google OAuth, callback URLs, criação automática de perfil e testes de sessão. | Sprint 5 |

## Metodologia Scrum

| Elemento | Definição para GDGJobs |
|---|---|
| Cadência | Sprints de 2 semanas; 12 sprints em aproximadamente 6 meses. |
| Product Owner | Prioriza o backlog, aceita histórias e resolve decisões de produto. |
| Scrum Master | Remove impedimentos, protege a cadência e acompanha métricas. |
| Time de desenvolvimento | Entrega incrementos potencialmente utilizáveis: frontend, backend, dados e qualidade. |
| Sprint Planning | Selecionar histórias prontas, estimar capacidade e definir uma meta clara. |
| Daily | Máximo de 15 minutos: progresso, plano e impedimentos. |
| Review | Demonstrar o incremento funcionando para stakeholders e registrar feedback. |
| Retrospectiva | Escolher uma melhoria de processo acionável para o sprint seguinte. |

### Definition of Ready (DoR)

Uma história só entra no sprint quando possui objetivo, critérios de aceitação, regras de negócio, dependências conhecidas, dados necessários e decisão de UX mínima.

### Definition of Done (DoD)

Uma história é concluída quando:

- critérios de aceitação foram verificados;
- código revisado e aprovado em PR (**branch → `main`**, sem push direto em `main`);
- commits e título de squash merge seguem [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0-beta.4/);
- testes relevantes passam e não há regressão conhecida;
- RLS e validação de entrada foram avaliadas para qualquer alteração que lide com dados;
- documentação e variáveis de ambiente foram atualizadas;
- funcionalidade foi demonstrada na Sprint Review.

## Product backlog priorizado

| Prioridade | Épico | História / entrega | Versão | Estado |
|---:|---|---|---|---|
| P0 | Fundação | Definir ambiente local, lint, testes e CI | V1 | **S1-01 aprovada** (2026-08-15); CI remoto pendente de Git/Actions |
| P0 | Fundação | Configurar Supabase Auth com Google OAuth e definir a hospedagem | V1/V2 | Autenticação decidida; configuração pendente |
| P0 | Design System | Alinhar o MVP à referência visual do DevFest Lauro e criar tokens globais de UI | V1 | DS-02 implementada; DS-01 e DS-05 pendentes de revisão formal |
| P1 | Design System | Consolidar biblioteca oficial no Figma, revisão colaborativa e handoff para produção | Transversal | Bloqueado: equipe ainda não possui acesso aos componentes Figma |
| P0 | LGPD | Consentimento granular e registro de preferências por finalidade | Transversal | Não iniciado — bloqueia produção |
| P0 | LGPD | Aplicar e testar RLS por perfil de acesso | Transversal | Código preparado; não aplicado |
| P0 | LGPD | Exportação, correção e exclusão de dados pessoais | Transversal | Não iniciado — bloqueia produção |
| P0 | LGPD | Auditoria de operações sobre dados pessoais | Transversal | Não iniciado — bloqueia produção |
| P0 | LGPD | Anonimização/minimização de dados usados em ML | V3 | Não iniciado — bloqueia funcionalidades de ML com dados pessoais |
| P0 | LGPD | Protocolo, registro e comunicação de incidentes | Transversal | Não iniciado — bloqueia produção |
| P0 | Dados | Aplicar migration, configurar RLS, buckets de Storage e dados de exemplo | V1 | Código preparado; não aplicado |
| P0 | Vagas públicas | Conectar listagem, filtros e detalhe ao banco com apenas vagas aprovadas | V1 | Protótipo pronto; integração pendente |
| P0 | Administração | Autenticação administrativa e CRUD validado de vagas/empresas | V1 | Interface pronta; backend pendente |
| P1 | Ingestão | Modelar origem da vaga, submissão de empresas, conectores de API, fila, deduplicação e tratamento de falhas | V1/V2 | Novo — solicitado pelo Tech Lead |
| P1 | Ingestão | Avaliar scrapers por fonte, termos de uso, base legal e manutenção antes de construir conectores | V1/V2 | Novo — depende de aprovação de fontes |
| P1 | Curadoria | Fluxo pendente → aprovação/rejeição, histórico e publicação Realtime | V1 | Não iniciado |
| P1 | Curadoria | Validação automática e rubrica de revisão para comunidade/moderadores | V1 | Novo — solicitado pelo Tech Lead |
| P1 | Perfil | Onboarding, edição de perfil, skills e preferências | V2 | Não iniciado |
| P1 | Candidaturas | Candidatura com um clique, prevenção de duplicidade e dashboard | V2 | Dados preparados; interface parcial |
| P1 | Comunicação | E-mails transacionais via Resend | V2 | Não iniciado |
| P1 | Matching V2 | Busca/match por stack, nível, keywords e explicação do score | V2 | Base semântica preparada; integração pendente |
| P2 | IA V1 | Acionar enriquecimento Gemini no fluxo administrativo com revisão humana | V3 | Edge Function pronta; deploy pendente |
| P2 | IA V2 | Gerar e atualizar embeddings, exibir score e motivo do match | V3 | Base pronta; integração pendente |
| P2 | Recomendação | Capturar feedback consentido: visualização, salvar, candidatura, retirada e retorno da empresa | V3 | Novo — pré-requisito para filtragem colaborativa |
| P2 | Recomendação | Eventos consentidos, filtros colaborativos, métricas e experimento controlado | V3 | Planejado |
| P2 | IA responsável | Métricas de fairness, auditoria e canal para contestar recomendação | V3 | Planejado |

## Alinhamento com o Tech Lead — fluxo de dados e decisões

### Pipeline alvo

`Ingestão → Curadoria → Enriquecimento → Armazenamento → Recomendação → Feedback loop`

| Etapa | Entrega do backlog | Situação |
|---|---|---|
| Ingestão | Cadastro manual, submissões, APIs externas, scrapers aprovados, fila e deduplicação | Cadastro manual prototipado; demais itens novos no backlog |
| Curadoria | Validação automática, rubrica, revisão comunitária e decisão auditável | Status básico preparado; fluxo completo pendente |
| Enriquecimento | Gemini, tags/requisitos e embeddings | Edge Function preparada; deploy e revisão humana pendentes |
| Armazenamento | Supabase, pgvector, RLS e Storage | Migration preparada; ambiente real pendente |
| Recomendação | Score, fairness, explicabilidade e feedback loop | Matching V2 preparado; colaboração/fairness pendentes |

### ADR-001 — pesos do score de recomendação

**Status: aceita pelo Tech Lead Agent (2026-08-15).** Decisão técnica; não altera regras de curadoria nem autoriza envio de dados pessoais a IA.

O material recebido possui duas fórmulas incompatíveis: `0,52 + 0,34 + 0,26 = 1,12`, enquanto a fórmula final declara `0,5 + 0,3 + 0,2 = 1,0`. Um score ponderado precisa totalizar 1,0 para ser comparável e interpretável.

| Fase | Fórmula adotada | Justificativa |
|---|---|---|
| V2 | `0,70 semântico + 0,30 regras explícitas` | Ainda não há eventos históricos suficientes para filtragem colaborativa. A fórmula já está preparada no `match_jobs`, é reproduzível e explica a correspondência por stack, nível e modelo de trabalho. |
| V3 | `0,50 semântico + 0,30 colaborativo + 0,20 regras` | É a fórmula final do Tech Lead que soma 1,0. Só é ativada após consentimento, dados suficientes, avaliação offline e aceite do gate de LGPD. |

**Alternativa rejeitada por enquanto:** normalizar proporcionalmente os pesos `0,52/0,34/0,26` para aproximadamente `0,464/0,304/0,232`. Embora matematicamente válida, ela não corresponde à fórmula final declarada pelo Tech Lead e introduziria uma regra não validada pelo negócio.

### ADR-002 — fairness e explicabilidade

**Status: aceita pelo Tech Lead Agent (2026-08-15).** Fairness permanece guardrail/auditoria; atributos sensíveis não entram no ranking. Ativação de V3 continua bloqueada pelos controles LGPD e pelo DPO.

| Diretriz do Tech Lead | Ajuste proposto | Justificativa |
|---|---|---|
| Camada “regras + fairness” com peso de 0,20 | Usar os 0,20 para regras explícitas; aplicar fairness como guardrail de reordenação, monitoramento e auditoria. | Fairness não deve ser apenas um número misturado ao score, pois pode mascarar discriminação e dificultar auditoria. |
| Avaliar gênero, idade e localização | Não usar esses atributos para decidir o ranking. Quando estritamente necessário para auditoria, tratar separadamente, com finalidade definida, acesso restrito, agregação/anonimização e controles LGPD. | Evita que características potencialmente discriminatórias determinem recomendações individuais. |
| SHAP para explicabilidade | V2 exibe a decomposição direta do score; SHAP é avaliado apenas quando houver modelo preditivo não linear na V3. | Em score ponderado linear, os próprios componentes são explicações mais fiéis e fáceis de auditar. |

### Critérios de aceite do Tech Lead

- Confirmado: fórmula de V3 `0,50 / 0,30 / 0,20`.
- Confirmado: V2 sem filtragem colaborativa até existir volume de feedback consentido.
- Confirmado: fairness como guardrail e métrica de auditoria, sem usar atributo sensível para ranquear.
- Pendente humano: definir fontes permitidas para scrapers e APIs externas antes de qualquer implementação.
- Pendente humano: aprovar rubrica e responsáveis da curadoria antes do Sprint 4.

## Plano de sprints

**Executor técnico padrão:** Agente GDGJobs. O agente implementa, testa, documenta e **abre Pull Requests**; não toma decisões de negócio, não cria contas externas, não configura segredos reais nem aprova produção sem direção explícita dos responsáveis.

**Git:** o Executor **nunca** faz push em `main`. Fluxo: branch → PR → squash merge pelo mantenedor. Ver [`docs/contributing.md`](contributing.md).

**Commits:** mensagens no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0-beta.4/#especifica%c3%a7%c3%a3o) (`tipo(escopo): descrição`). Ex.: `docs(lgpd): add S1-03 personal data inventory for DPO review`.

**Shell obrigatório no Windows:** executar comandos em **PowerShell (`pwsh`)**, não em WSL. Chamadas Linux via WSL neste ambiente ficam lentas e atrasam lint, testes, install e build. Preferir `pnpm`, `git` e scripts nativos do Windows no `pwsh`. Só usar WSL se o comando for impossível no PowerShell e houver autorização explícita.

### Handoff para o agente executor

**Ponto de partida confirmado:** o protótipo visual compila com `pnpm run build`; Home, detalhe, Login, Admin, navegação mobile, favicon/PWA e DS-02 estão implementados em modo demonstrativo. O array de vagas, autenticação, cadastro, candidatura e curadoria ainda são simulados no frontend.

**Primeira ação do agente:** Sprint 2 — catálogo `approved` no Supabase de teste. Credenciais só em `.env.local` / `docs-local/`. Não iniciar OAuth, Gemini, deploy público ou curadoria sem as decisões deste documento.

#### Revisão Tech Lead — S1-03 (aprovada em 2026-08-15)

| Critério | Resultado |
|---|---|
| Inventário | `docs/lgpd-data-inventory.md` — 21 itens (P-01 a P-21) |
| Seis controles | Lacunas explícitas na tabela do gate |
| Protótipo + migration + planejado | Coberto; risco `match-jobs`/Gemini (P-16) documentado |
| Credenciais / dados reais | Ausentes |
| Escopo | Nenhum controle LGPD implementado |
| Git | Branch `docs/s1-03-lgpd-inventory`; PR para `main` (correto) |
| Qualidade | `pnpm lint`, 7 testes e `pnpm run build` verdes no `pwsh` |
| Commits | Commit `36ce67c` fora do Conventional Commits — usar título `docs(lgpd): add S1-03 personal data inventory for DPO review` no squash merge |

**Pendente humano (não bloqueia aprovação técnica):** DPO aceitar bases legais candidatas.

#### Revisão Tech Lead — S1-04 (aprovada em 2026-08-16)

| Critério | Resultado |
|---|---|
| `docs/contributing.md` | Branch, PR, Conventional Commits, DoD Git |
| `.github/PULL_REQUEST_TEMPLATE.md` | Checklist com evidências e Conventional Commits |
| Branch protection | Ruleset **Protect main** (`20903173`) ativo via API |
| Evidência | `docs/s1-04-branch-protection.md` + `.github/branch-protection-main.ruleset.json` |
| Regras | PR obrigatório, CI **Lint, test and build**, sem force-push/delete em `main` |
| Git | Branch `chore/s1-04-branch-protection`; commit `chore(process): document branch protection on main` |
| Qualidade | CI verde no PR; `pnpm lint`, 7 testes e build verdes no `pwsh` |
| Escopo | Processo/documentação; sem alteração de produto |

**Observação:** zero aprovações obrigatórias no ruleset (mantenedor único); revisão humana permanece no DoD. Reavaliar quando houver segundo mantenedor.

#### Revisão Tech Lead — S1-02 (aprovada em 2026-08-15)

| Critério | Resultado |
|---|---|
| Inventário com hashes | `docs/favicons-inventory.md` — 9 arquivos, SHA-256 documentados |
| Pasta aninhada | Removida; `Test-Path` confirma ausência |
| Pasta pai | 9 arquivos intactos em `docs/design-system/referencias/favicons_package/` |
| `public/` | Intacto; hashes distintos do pacote de referência (correto) |
| Referências de runtime | `index.html`, `App.jsx`, `site.webmanifest` apontam só para `/public` |
| Qualidade | `pnpm lint`, `pnpm test` (7) e `pnpm run build` verdes no `pwsh` |
| Escopo | Sem alteração de UI, tokens, lint/CI ou integrações |

#### Revisão Tech Lead — S1-01 (aprovada em 2026-08-15)

| Critério | Resultado |
|---|---|
| `pnpm lint` em `pwsh` | Passou |
| `pnpm test` | 7 testes em 2 arquivos |
| `pnpm run build` | Vite 8, `dist/` gerado |
| Scripts e deps de qualidade pinadas | Atendido; runtime ainda `latest` (dívida conhecida, fora do S1-02) |
| Workflow CI | `.github/workflows/ci.yml` em push/PR; Node 22; pnpm 10.30.1; `--frozen-lockfile` |
| Documentação | `README.md` e `docs/quality-ci.md` |
| Escopo | Extração de `filterJobs`/`App` sem mudança de Design System nem integrações |

**Não bloqueia S1-02:** Actions ainda não validado em PR real; `supabase/**` fora do ESLint; dependências de runtime não pinadas.

### Sprint 1 — histórias executáveis

| ID | Tipo | Perfil | Objetivo | Estado |
|---|---|---|---|---|
| S1-01 | Qualidade / DevOps | DevOps/Quality Engineer | Lint, testes básicos e pipeline CI que falha PR com erro de lint, teste ou build | **Aprovada** pelo Tech Lead (2026-08-15) |
| S1-02 | Organização | Fullstack Engineer | Inventariar e tratar a cópia aninhada de `favicons_package` sem apagar arquivo sem validação | **Aprovada** pelo Tech Lead (2026-08-15) |
| S1-03 | Privacidade | Security & LGPD Engineer | Inventário de dados pessoais e riscos LGPD com base no protótipo e na migration preparada | **Concluída** — merge `86e590e` em `main`; bases legais aguardam DPO |
| S1-04 | Processo | DevOps/Quality Engineer | Formalizar convenções de PR, evidência e Definition of Done no repositório | **Aprovada** pelo Tech Lead (2026-08-16); merge do PR `chore/s1-04-branch-protection` pendente |
| S1-05 | Decisão | Humano (PO + Tech Lead) | Fechar C-01 (Vercel vs Firebase Hosting) e confirmar se haverá projeto Supabase de desenvolvimento | Fora do Executor |

**Fora de escopo do Sprint 1:** Tailwind/shadcn, OAuth real, migration aplicada, Gemini, Resend, Storage, Realtime, deploy, curadoria e qualquer alteração visual que recrie componentes.

#### S1-01 — Lint, testes e CI

- **Escopo:** ESLint para o frontend Vite/React; Vitest com pelo menos testes da lógica de busca/filtros e um smoke de renderização; GitHub Actions em `push`/`pull_request` executando `lint`, `test` e `build`; scripts no `package.json`; versões de dependências de qualidade pinadas (não usar `latest` nas novas libs). Instalar e validar tudo em **PowerShell (`pwsh`)**, sem WSL.
- **Fora:** não conectar serviços externos; não alterar tokens visuais; não extrair Design System novo; não rodar a validação local via WSL.
- **Riscos:** `package.json` usa `latest` em runtime — não ampliar esse padrão; CI sem repositório remoto não valida PRs reais.
- **Aceite:** `pnpm lint`, `pnpm test` e `pnpm run build` passam localmente; workflow em `.github/workflows/` falha o PR se qualquer um falhar; README ou `docs/` documenta os comandos.
- **Revisão:** aprovada. Evidência reexecutada pelo Tech Lead em `pwsh` (lint, 7 testes, build).

#### S1-02 — Ativos duplicados

- **Escopo:** comparar byte a byte (ou hash) `docs/design-system/referencias/favicons_package/favicons_package/` com a pasta pai e com `public/` (`favicon.svg`, `site.webmanifest` e demais ícones de runtime). Registrar o inventário em `docs/` (arquivo curto). Remover **somente** a pasta aninhada se for cópia idêntica e **não referenciada** por HTML, CSS, JSX ou manifest. Não apagar `public/` nem a pasta pai sem prova.
- **Fora:** não alterar tokens, componentes, PWA em runtime, lint/CI nem Design System.
- **Riscos:** apagar ícone usado em `index.html` ou `site.webmanifest` quebra favicon/PWA; WSL deixa `Get-FileHash`/`pnpm` mais lentos — usar `pwsh`.
- **Aceite:** inventário versionado com hashes/caminhos; exclusão só da duplicata validada; `public/` intacto; `pnpm lint`, `pnpm test` e `pnpm run build` verdes no `pwsh`.
- **Revisão:** aprovada. Pasta aninhada idêntica à pai (9/9 SHA-256); sem referência de runtime; removida. Evidência em `docs/favicons-inventory.md`; hash do pai (`862FEC07…`) conferido pelo Tech Lead.

#### S1-03 — Inventário LGPD

- **Escopo:** documento em `docs/` listando dados pessoais já visíveis no protótipo, previstos na migration e planejados (perfil, candidatura, consentimento, auditoria, embeddings). Classificar finalidade, base legal candidata, retenção sugerida, risco e controle do gate correspondente. Dados atuais são fictícios.
- **Fora:** não implementar consentimento, RLS em ambiente real, exportação nem protocolo operacional.
- **Aceite:** tabela revisável pelo DPO; lacunas dos seis controles explícitas; nenhuma credencial no documento.
- **Revisão:** aprovada. Evidência em `docs/lgpd-data-inventory.md`; qualidade verde no `pwsh`. Merge do PR com título Conventional Commits.

#### S1-04 — Convenções de PR e evidência

- **Escopo:** [`docs/contributing.md`](contributing.md) (branch, PR, [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0-beta.4/)), `.github/PULL_REQUEST_TEMPLATE.md`, checklist de evidência.
- **Aceite:** guia e template versionados; DoD exige PR + Conventional Commits + CI verde.
- **Revisão:** aprovada. Ruleset ativo; evidência em `docs/s1-04-branch-protection.md`. Squash merge: `chore(process): document branch protection on main`.

#### S1-05 — Hospedagem e ambiente (humano)

- C-01 permanece com Product Owner + Tech Lead.
- Executor não provisiona Vercel, Firebase nem Supabase.

**Validação obrigatória em toda entrega do agente:** build de produção, critérios de aceite da história, documentação atualizada e evidência visual para mudanças de interface. Para UI, consultar `docs/design-system-communication.md` e as referências antes de criar ou alterar componentes.

| Sprint | Meta | Entregas principais | Executor técnico | Dependência humana / critério de saída |
|---|---|---|---|---|
| 1 | Preparar base confiável | Lint, testes, CI, inventário de dados pessoais, organização de ativos duplicados e definição de convenções de PR | Agente GDGJobs | Tech Lead/PO escolhem hospedagem (C-01); pipeline valida build, lint e testes |
| 2 | Publicar catálogo real | Aplicar migration em Supabase de desenvolvimento, seed, Storage, RLS testada e conectar listagem/detalhe | Agente GDGJobs | Responsável fornece projeto/credenciais de desenvolvimento; visitante vê apenas vagas aprovadas |
| 3 | Administrar vagas | Autenticação administrativa, CRUD com validação de entrada e trilha de testes | Agente GDGJobs | PO fecha D-01 a D-06 até o encerramento; admin cadastra vaga pendente com segurança |
| 4 | Curar e publicar | Aprovação/rejeição, histórico, auditoria e Realtime | Agente GDGJobs | PO/Comunidade aprovam regras de curadoria; vaga aprovada aparece no catálogo sem recarregar |
| 5 | Criar perfil | Supabase Auth com Google, onboarding, edição, correção e consentimento granular | Agente GDGJobs | Responsável configura OAuth/URLs; candidato revisa finalidades e pode revogar consentimentos |
| 6 | Candidatar | Candidatura em um clique, prevenção de duplicidade, dashboard, exportação e exclusão | Agente GDGJobs | PO define D-08, D-09 e política de reabertura; titular exerce direitos pelos fluxos acessíveis |
| 7 | Comunicar | Resend para candidatura, mudança de status e aprovação de vaga | Agente GDGJobs | Responsável fornece domínio/credenciais Resend; templates homologados |
| 8 | Match por regras | Filtros, keywords, explicação de compatibilidade e revisão da normalização de tecnologias | Agente GDGJobs | Tech Lead aceita regra de evolução de `TEXT[]`; resultado reproduzível e explicável |
| 9 | Enriquecer vagas | Gemini em ambiente controlado, revisão humana, logs e minimização de dados | Agente GDGJobs | DPO/Tech Lead aprovam política Gemini (C-04); nenhuma informação pessoal segue para IA sem controle definido |
| 10 | Buscar semanticamente | Embeddings, `match-jobs`, score V2 e auditoria de processamento | Agente GDGJobs | Tech Lead aprova ADR-001/002; match usa semântica e regras com trilha de auditoria |
| 11 | Preparar V3 | Instrumentação consentida, anonimização, baseline de fairness e protocolo de incidentes | Agente GDGJobs | DPO aprova retenção e runbook; eventos anonimizados e auditáveis |
| 12 | Validar recomendação | Protótipo colaborativo offline, avaliação, teste dos direitos do titular e gate LGPD | Agente GDGJobs | PO/DPO aceitam as evidências dos seis controles; produção só é liberada após aceite formal |

## Fluxo de Pull Request

**Regras:** sem push direto em `main`; commits em [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0-beta.4/). Ver [`docs/contributing.md`](contributing.md).

1. Criar issue ou item do backlog com critérios de aceitação (`S1-03`, história ou bug).
2. Atualizar `main` e criar branch: `feat/`, `fix/`, `chore/` ou `docs/<id>-descricao`.
3. Desenvolver uma única entrega coesa; mensagens de commit no padrão `tipo(escopo): descrição`.
4. Push da branch; PR **base: `main`** ← compare: `<branch>`.
5. CI executa lint, testes e build no PR.
6. Revisão humana; PRs de RLS, auth, secrets ou IA exigem revisão de segurança.
7. Mantenedor faz **squash merge** com título Conventional Commits e vincula à Sprint Review.

### Critérios de evidência (obrigatórios)

| Tipo de mudança | Evidência mínima |
|---|---|
| Qualidade / CI | Logs locais ou de Actions com `lint`, `test` e `build` verdes |
| Interface | Captura desktop e mobile dos fluxos alterados; PR cita `docs/design-system-communication.md` e a referência em `docs/design-system/referencias/` |
| Dados / RLS | Cenários visitante, candidato e admin; plano de rollback da migration |
| LGPD | Inventário ou controle atualizado; nenhum dado pessoal real em fixture |
| IA | Confirmação de que nenhum dado pessoal foi enviado ao modelo |

Sem CI verde no PR, a história do Sprint 1 não entra em Done.

Template versionado: [`.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md). Fluxo Git e Conventional Commits: [`docs/contributing.md`](contributing.md).

## Próximas etapas imediatas

1. **Sprint 2:** aplicar migrations no projeto de teste (SQL Editor) e preencher `.env.local` via canal seguro. PR `feat/s2-catalog-approved-jobs`. Evidência RLS: [`docs/s2-catalog-rls.md`](s2-catalog-rls.md).
2. **DPO:** revisar bases legais candidatas em `docs/lgpd-data-inventory.md`.
3. **Product Owner + Comunidade GDG:** fechar D-01 a D-06 antes do Sprint 4; o agente não deve inferir regras de curadoria.
4. **DPO + Tech Lead:** política Gemini (C-04) e evidências dos seis controles LGPD permanecem bloqueadoras de produção; ADR-001/002 já foram aceitas tecnicamente.
