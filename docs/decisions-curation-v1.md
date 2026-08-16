# Decisões de curadoria V1 — D-01 a D-06

**Status:** aceitas pelo Product Owner e pela comunidade GDG em 2026-08-16.  
**Escopo:** regras de produto e contrato técnico para o Sprint 4. Implementação em dois PRs funcionais após este documento.  
**Fora:** OAuth candidato, completude de perfil na UI, Resend, Gemini, deploy público.

Documento de governança. Detalhe de schema/rollback da feature fica em `docs/s4-curation-flow.md` no PR de dados.

## Quórum (D-03) — confirmado pela comunidade

Na rodada corrente:

| Resultado | Efeito |
|---|---|
| 2 aprovações independentes | `jobs.status = approved` |
| 2 rejeições independentes | `jobs.status = rejected` |
| 1 aprovação + 1 rejeição | Permanece `pending`; `needs_moderation` derivado; moderador decide via RPC |
| SLA 72 h / reatribuição 7 dias | **Manual** no Sprint 4 (fila + operação humana). Automação depois. |

A decisão **não** é calculada só na interface. Uma RPC transacional registra o parecer, impede duplicidade e autoavaliação, aplica o quórum e altera o status.

## D-01 — Perfil mínimo para candidatura (produto agora; código no Sprint 5)

**Obrigatórios (quando o onboarding existir):** nome, e-mail autenticado, nível de experiência, ao menos 1 tecnologia, localidade/modalidade.

**Opcionais:** bio, LinkedIn, GitHub, currículo.

**LGPD:** compartilhar o perfil com a empresa na candidatura é tratamento de dados (finalidade específica). **Não** chamar automaticamente de consentimento. O DPO enquadra a base legal adequada antes de produção ([ANPD — bases legais](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes/perguntas-frequentes)). Sprint 4 **não** implementa esse fluxo.

## D-02 — Quem cura

- Papéis: `candidate`, `curator`, `moderator`, `admin`.
- Curadores e moderadores são **indicados manualmente** no V1 (admin no projeto de teste).
- `admin` herda permissão operacional de moderador, **exceto** revisar vaga que ele submeteu (`submitted_by`).
- Candidatos não curam vagas.

## D-04 — Mecanismo e rubrica

Revisão **individual** com rubrica. Sem votação pública.

Códigos de decisão **obrigatórios**; comentário interno **opcional**.

Critérios mínimos:

1. Empresa e oportunidade identificáveis.
2. Descrição com responsabilidades, requisitos, nível e localidade/modalidade.
3. Sem exigências discriminatórias ou conteúdo enganoso.
4. Canal de candidatura definido (fluxo interno GDGJobs no V1). URL externa **não** é obrigatória no Sprint 4.
5. Vaga ainda ativa e relacionada à área tech.

## D-05 — Sem publicação direta

Admin **não** publica unilateralmente no V1. Tudo entra `pending` (já é o comportamento do S3-01).

Prioridade: somente `normal` | `urgent`. `urgent` exige motivo interno e só admin marca. Prioridade **só** reordena a fila — não altera quórum, rubrica nem permite bypass.

## D-06 — Rejeição e reenvio

- Rejeição exige código da rubrica; comentário interno opcional.
- Admin corrige a vaga e reenvia.
- Reenvio **não apaga** o histórico: incrementa `curation_round` e abre nova rodada. UNIQUE de revisor: `(job_id, curation_round, reviewer_id)`.

## Contrato técnico para o Sprint 4

### Status e `needs_moderation`

- Enum `job_status`: adicionar `rejected`. **Não** adicionar `needs_moderation` como status.
- Vaga permanece `pending` até decisão final.
- `needs_moderation` = view ou consulta: rodada corrente com 1 approve + 1 reject.

### Autoria (`submitted_by`)

- Novas vagas: sempre `auth.uid()` no backend/RPC (não confiar no cliente).
- Legado (seed/vagas de teste): backfill **antes** de `NOT NULL`, **ou** `NULL` permitido só para legado, documentado em `docs/s4-curation-flow.md`.

### RPC

Função transacional que:

1. Insere o parecer na rodada corrente.
2. Recusa duplicidade e autoavaliação (`reviewer_id = submitted_by`).
3. Aplica 2×approve / 2×reject / deixa 1×1 em `pending` para o moderador.
4. Atualiza `jobs.status` (e timestamps de decisão) de forma atômica.

### Entregas (PRs separados)

| PR | Perfil | Branch | Squash |
|---|---|---|---|
| Dados | Database/Supabase Engineer | `feat/s4-curation-schema` | `feat(curation): add transactional review RPC and decision history` |
| UI | Fullstack Engineer | `feat/s4-curation-ui` | `feat(curation): add curator queue and rubric review UI` |

UI chama **somente** a RPC para decidir. Realtime já está em `jobs`. Notificação in-app no Sprint 4; e-mail (Resend) no Sprint 7.

## Fora deste V1 de curadoria

OAuth / verificação automática, cron de SLA, `application_url` obrigatório, consentimento granular, Gemini, deploy.
