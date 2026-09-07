# Decisões de candidatura V1 — D-08 e D-09

**Status:** aceitas para homologação V1 deste repositório em 2026-09-06 (defaults do Product Owner técnico; o PO humano ajusta antes do Sim se discordar).  
**Escopo:** regras de produto e contrato técnico mínimo para o Sprint 6. Implementação em PRs funcionais **após** o merge desta governança.  
**Fora:** SQL/RPC/UI apply neste PR; Router; Resend; Gemini; deploy público; visão empresa; consentimento granular.

Documento de governança. Detalhe de schema/rollback da feature de candidatura fica no PR de dados do Sprint 6.

Espelho do processo: [`decisions-curation-v1.md`](decisions-curation-v1.md) (PR #12). Perfil mínimo já fechado: D-01 no mesmo arquivo de curadoria; código no Sprint 5.

## Tabela resumo

| ID | Decisão | Estado | Efeito no V1 de homologação |
|---|---|---|---|
| D-08 | Payload da candidatura 1 clique | **Resolvida** | Snapshot do perfil D-01 completo; links do perfil se existirem; sem formulário extra no apply |
| D-09 | Ciclo de vida | **Resolvida** | Uma candidatura por par (candidato, vaga); retirar → `withdrawn` sob condições; sem editar/reenviar/reabrir |

## D-08 — Payload da candidatura 1 clique (V1 homologação)

A candidatura **não** coleta dados novos no momento do apply. O payload é um **snapshot** do perfil já completo (D-01):

- `full_name`
- e-mail da conta Auth
- `skills`
- `preferences` (nível, localidade/modalidade e demais chaves já persistidas)
- `bio`

Se estiverem preenchidos no perfil, entram no snapshot **sem** campo extra na UI de apply:

- `linkedin`
- `github`
- `cv_url`

**Fora do V1:** carta de apresentação; upload de arquivo na hora do apply; qualquer campo que não exista no perfil.

**Copy:** informar que o perfil será compartilhado com a empresa anunciante (finalidade específica). **Não** rotular como consentimento LGPD. Base legal da candidatura e do currículo/URL (inventário [P-12](lgpd-data-inventory.md)) permanece com o DPO. Fixture visual de sessão ([P-01](lgpd-data-inventory.md)) não é dado de titular.

## D-09 — Ciclo de vida (V1 homologação)

- **Uma** candidatura por par (candidato, vaga): `UNIQUE (job_id, candidate_id)` — já previsto em [`202608150001_ai_matching.sql`](../supabase/migrations/202608150001_ai_matching.sql).
- **Retirar:** `status` → `withdrawn` somente enquanto a vaga está `approved` **e** o status da candidatura ∈ `{submitted, reviewing}`.
- **Fora do V1:** editar o payload depois de enviar; reenviar a mesma vaga; reabrir `withdrawn`/`rejected`/`accepted`; cron ou prazo automático de expiração.

Leitura/escrita administrativa usa as policies RLS **já existentes** (`is_admin()`). Visão e fluxo da empresa anunciante **fora** deste V1.

Alinha o item de backlog **P-01** (ciclo de vida): reabertura e prazos automáticos ficam **bloqueados** no V1; a transição permitida é só a retirada acima.

## Contrato técnico mínimo para o Sprint 6

### Pré-condições do apply

1. Sessão autenticada; `profiles.id = auth.uid()`.
2. Perfil D-01 completo (validação no cliente **e** recusa no servidor/RPC se incompleto).
3. Vaga `status = approved`.
4. Inserção atômica; segunda tentativa no mesmo par falha no UNIQUE (sem “segunda linha”).

### Snapshot

Persistir o payload D-08 no momento do apply (coluna jsonb ou equivalente no PR de dados). O snapshot **não** muda se o candidato editar o perfil depois. Não confiar no cliente para inventar `role` nem `candidate_id` (sempre `auth.uid()`).

### Status

Enum já existente: `submitted`, `reviewing`, `accepted`, `rejected`, `withdrawn`.  
V1 homologação: apply cria `submitted`; retirar só `submitted`|`reviewing` → `withdrawn` nas condições de D-09. Transições `reviewing`/`accepted`/`rejected` por empresa **não** fazem parte deste V1 (admin via RLS existente, se necessário em operação).

### RPC (direção)

Função(ões) transacional(is) que:

1. Conferem sessão, D-01, vaga `approved` e ausência de linha no par.
2. Inserem candidatura + snapshot.
3. Recusam apply duplicado.
4. Aplicam retirada apenas nas transições de D-09.

A UI chama **somente** a RPC para aplicar ou retirar. Sem `service_role` no browser.

### Entregas (PRs posteriores — não este)

| Tipo | Depois do merge desta governança |
|---|---|
| Dados / RLS | Schema de snapshot se faltar, RPC, testes `test:rls` de candidatura |
| UI | Apply 1 clique + retirar; dashboard mínimo do candidato |

## Referências LGPD

| ID | Uso nesta decisão |
|---|---|
| [P-01](lgpd-data-inventory.md) | Fixture de UI (iniciais/rótulo admin) — não tratar como titular real |
| [P-11](lgpd-data-inventory.md) | Linha em `applications` (par vaga/candidato, status, timestamps) |
| [P-12](lgpd-data-inventory.md) | Currículo: no V1 só `cv_url` já no perfil; carta e upload no apply **fora** |

Produção continua bloqueada pelos seis controles do gate. Homologação: dados fictícios ou autorizados.

## Fora deste V1 de candidatura

Router (ARQ-02), Resend, Gemini, deploy, OAuth (já Sprint 5), consentimento granular, exportação/exclusão do titular como história própria, painel da empresa.
