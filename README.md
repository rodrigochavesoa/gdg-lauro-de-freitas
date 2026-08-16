# GDG Lauro de Freitas - Ecossistema de Projetos

Este repositório centraliza as definições, arquitetura e planejamento estratégico para o desenvolvimento da plataforma digital do Google Developer Group (GDG) Lauro de Freitas. O ecossistema é composto por três projetos principais voltados para o impacto e engajamento da comunidade local.

---

## 🚀 Projetos em Pauta

1. **Site Oficial do GDG:** Linha do tempo dos meetups, painel com métricas de impacto da comunidade e módulo inicial de vagas.
2. **GDGLAURO Jobs:** Um motor inteligente e curado para mapeamento, recomendação e matching de vagas de tecnologia.
3. **GDGLAURO Language:** Plataforma focada em capacitação para *Tech Interviews* (perguntas comuns, vocabulário técnico e Método STAR) aplicada ao desenvolvimento mobile.

---

## 🏗️ Arquitetura e Stack Técnica (GDGLAURO Jobs)

O ecossistema foi desenhado para operar com **Custo Zero ($0/mês) até atingir 10.000 usuários ativos**, alavancando os planos gratuitos (*free tiers*) das tecnologias modernas.

*   **Frontend:** Next.js 14 (App Router), Tailwind CSS e shadcn/ui.
*   **Backend & Infra:** Next.js API Routes, Supabase Edge Functions e Vercel Edge Runtime.
*   **Autenticação:** Firebase Auth (com Login Google em 1-click).
*   **Banco de Dados & Armazenamento:** PostgreSQL (Supabase), Supabase Storage e Realtime subscriptions.
*   **Hospedagem & CI/CD:** Firebase Hosting e GitHub Actions.
*   **Inteligência Artificial & Dados:** Gemini API, Xenova/ONNX (browser ML), scikit-learn e `pgvector`.

---

## 🔄 Fluxo de Dados End-to-End

O pipeline de processamento do motor de vagas opera em 5 etapas principais:

1.  **Ingestão:** Coleta através de Scrapers, submissões manuais e APIs externas.
2.  **Curadoria:** Validação automatizada, revisão pela comunidade e aplicação de rubricas.
3.  **Enriquecimento:** Uso da **Gemini API** para geração de tags automáticas e embeddings.
4.  **Armazenamento:** Persistência no Supabase utilizando `pgvector` e aplicação estrita de *Row-Level Security* (RLS).
5.  **Recomendação:** Execução do modelo de Machine Learning integrado a um ciclo de feedback contínuo do usuário.

---

## 🧠 Motor de Recomendação (ML com Fairness)

As recomendações inteligentes combinam equidade, explicabilidade e busca semântica através de um score ponderado:

$$\text{Score Final} = (0.5 \times \text{Semântico}) + (0.3 \times \text{Colaborativo}) + (0.2 \times \text{Regras})$$

*   **Camada 1: Embeddings (Peso: 0.5):** Similaridade semântica entre o perfil do candidato e a vaga via `pgvector`.
*   **Camada 2: Filtragem Colaborativa (Peso: 0.3):** Identificação de padrões coletivos por matriz usuário-vaga.
*   **Camada 3: Regras + Fairness (Peso: 0.2):** Diversidade forçada, correção de viés e explicabilidade via SHAP, garantindo a não-discriminação por gênero, idade ou localização.

---

## 🛡️ Segurança e Privacidade (LGPD por Design)

Conformidade e governança de dados integradas desde o primeiro dia de desenvolvimento:

*   **Consentimento Granular:** Autonomia para o usuário escolher o que compartilhar.
*   **Isolamento Absoluto:** *Row-Level Security* (RLS) direto no banco de dados para impedir acessos cruzados.
*   **Direitos do Titular:** Opções nativas para exportação, correção e exclusão de dados a qualquer momento.
*   **Auditoria Completa:** Registro e log detalhado de todas as operações e acessos a dados pessoais.
*   **Anonimização:** Dados pessoais passam por processamento de anonimização antes de alimentar os modelos de ML.
*   **Gestão de Incidentes:** Protocolo estruturado de notificação em conformidade com as diretrizes da ANPD.

Inventário de dados pessoais (S1-03): [`docs/lgpd-data-inventory.md`](docs/lgpd-data-inventory.md).

---

## 🎨 Design System

Garantia de consistência visual e integridade da marca em todos os pontos de contato:

*   Uso de tokens globais de cores e tipografia alinhados à identidade oficial do GDG e diretrizes do Google.
*   Biblioteca compartilhada de componentes desenvolvida no Figma, servindo de forma cross-platform ao Site, Jobs e Language.

Referência operacional do MVP: [`docs/design-system-communication.md`](docs/design-system-communication.md).

---

## 📅 Organização e Próximos Passos

O acompanhamento e as tarefas do time seguem o planejamento estruturado:

*   **Gestão de Demandas:** Utilização do ClickUp e Trello para rastreamento de tarefas e progresso.
*   **Padrões de Engenharia:** Configuração de Gitflow, padronização de commits e sincronizações semanais assíncronas.

Backlog e sprints: [`docs/project-backlog-scrum.md`](docs/project-backlog-scrum.md).

Para dúvidas ou suporte, entre em contato através do e-mail oficial da comunidade: [gdglaurodefreitas@gmail.com](mailto:gdglaurodefreitas@gmail.com).

---

## Desenvolvimento local — protótipo GDGJobs (MVP)

O incremento atual neste repositório é um frontend **React/Vite** com catálogo no Supabase de **teste**. Use **PowerShell (`pwsh`)** no Windows (não use WSL).

```powershell
Copy-Item .env.example .env.local
# Preencher URL e publishable key via canal seguro — nunca commitar

pnpm install
pnpm lint
pnpm test
pnpm run build
```

Contribuição (branch + PR, [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0-beta.4/)): [`docs/contributing.md`](docs/contributing.md). Segurança: [`docs/security-and-documentation.md`](docs/security-and-documentation.md). Supabase teste: [`docs/supabase-dev-env.md`](docs/supabase-dev-env.md). Catálogo e RLS: [`docs/s2-catalog-rls.md`](docs/s2-catalog-rls.md).
