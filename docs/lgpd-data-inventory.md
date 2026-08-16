# Inventário de dados pessoais — GDGJobs (S1-03)

**Destinatário:** DPO / privacidade  
**Data:** 2026-08-15  
**Escopo:** protótipo visual (`src/App.jsx`), migration preparada (`supabase/migrations/202608150001_ai_matching.sql`) e funcionalidades planejadas no backlog.  
**Fora deste documento:** implementação de consentimento, RLS em ambiente real, exportação, exclusão operacional ou protocolo de incidentes.

**Premissa:** os dados visíveis hoje são **fictícios**. Não há ambiente Supabase, OAuth, Gemini, Resend nem Storage conectados. Este inventário não contém credenciais, chaves ou dados reais de titulares.

**Revisão Tech Lead:** aprovada em 2026-08-15. Entrega técnica completa; bases legais permanecem candidatas até aceite do DPO. PR em `docs/s1-03-lgpd-inventory`.

**Bases legais** na coluna correspondente são **candidatas** (LGPD art. 7º e, se couber, art. 11). O DPO deve aceitar ou substituir cada uma antes de produção.

## Lacunas dos seis controles do gate

Enquanto qualquer linha estiver pendente, o uso permitido é só desenvolvimento/homologação com dados fictícios ou autorizados. Produção exige evidência e aceite do Product Owner.

| Controle do gate | Estado atual | Lacuna explícita |
|---|---|---|
| Consentimento granular | Inexistente no protótipo e na migration | Não há finalidades selecionáveis, versão do termo, data, prova nem revogação. |
| Row-Level Security | Policies escritas na migration; **não aplicadas** em projeto real | Sem ambiente, teste de isolamento (visitante / candidato / admin) não foi executado. |
| Direitos do titular | Só edição visual fictícia; sem fluxos | Não há correção persistida, exportação nem exclusão/anonimização sob demanda. |
| Registro de operações | Inexistente | Não há tabela nem trilha de ator, ação, data e recurso em acesso/alteração/processamento. |
| Anonimização para ML | Código de Edge Function preparado; sem deploy | `match-jobs` monta texto com `headline`, `bio` e `skills` e envia ao Gemini para embedding. Sem minimização, sem anonimização, sem C-04. |
| Notificação de incidentes | Inexistente | Sem protocolo, responsável, registro, avaliação de risco nem modelo de comunicação (LGPD art. 48). |

## Inventário revisável

| ID | Dado / atributo | Origem | Titular típico | Finalidade declarada | Base legal candidata (DPO) | Retenção sugerida | Risco | Controle do gate |
|---|---|---|---|---|---|---|---|---|
| P-01 | Iniciais `AM`, rótulo “Admin GDG” | Protótipo (UI) | Pessoa fictícia | Demonstrar sessão e painel | Não aplicável (fixture) | Até remover o mock | Baixo em homologação; médio se alguém tratar como dado real | Direitos do titular (fixture não deve ir a produção) |
| P-02 | Campo de e-mail no login (não persistido) | Protótipo (UI) | Candidato | Demonstrar cadastro/login | Consentimento ou execução de contrato, quando houver conta real | Não reter até Auth existir; depois, vida da conta + prazo de exclusão | Médio: coleta visual sem aviso de finalidade | Consentimento granular; direitos do titular |
| P-03 | Estado `logged` / `applicationSent` só em memória | Protótipo (UI) | Candidato fictício | Simular login e candidatura de um clique | Execução de contrato (quando real) | Não persiste | Baixo hoje; alto se persistir sem isolamento | RLS; registro de operações |
| P-04 | Texto de busca e filtros (cargo, stack, nível) | Protótipo (UI) | Visitante | Filtrar vagas públicas | Legítimo interesse (catálogo) ou execução de contrato | Sessão; sem log hoje | Baixo; sobe se logs de busca identificarem o usuário | Registro de operações; anonimização se for a ML |
| P-05 | `auth.users` (e-mail, provedor Google, `id`) | Planejado (Supabase Auth) | Candidato / admin | Autenticar; vincular `profiles.id` | Execução de contrato; consentimento para OAuth Google | Vida da conta; residual mínimo após exclusão | Alto: identificador direto | Consentimento; RLS; direitos do titular |
| P-06 | `profiles.full_name` | Migration | Candidato / admin | Identificar o titular no perfil e na candidatura | Execução de contrato | Vida da conta + prazo pós-exclusão definido pelo DPO | Alto | RLS; direitos do titular; registro de operações |
| P-07 | `profiles.avatar_path` | Migration + Storage planejado | Candidato / admin | Foto de perfil | Execução de contrato; consentimento se biometria/reconhecimento for usado (não previsto) | Vida da conta; apagar objeto no Storage na exclusão | Alto (imagem) | RLS; direitos do titular |
| P-08 | `profiles.headline`, `bio`, `skills` | Migration | Candidato | Completar perfil; matching explícito e semântico | Execução de contrato para candidatura; **consentimento específico** para embedding/IA | Até atualização ou exclusão; embedding deve cair junto | Alto se enviado a Gemini (código atual de `match-jobs`) | Consentimento; anonimização para ML; C-04 |
| P-09 | `profiles.preferences` (jsonb) | Migration | Candidato | Preferências de busca/vaga (conteúdo ainda não fechado) | Consentimento e/ou execução de contrato, conforme o que o json guardar | Revisar quando D-01 fechar o perfil mínimo | Alto se incluir localização precisa, salário ou dados sensíveis | Consentimento; minimização |
| P-10 | `profiles.role` (`candidate` / `admin`) | Migration | Usuário autenticado | Autorização | Legítimo interesse (segurança) / execução de contrato | Vida da conta | Médio: elevação de papel (já há restrição de `UPDATE` na migration) | RLS; registro de operações |
| P-11 | `applications` (`job_id`, `candidate_id`, `status`, timestamps) | Migration | Candidato | Registrar candidatura; impedir duplicata | Execução de contrato | Processo seletivo + prazo legal/contratual (DPO) | Alto: revela interesse profissional | RLS; direitos do titular; registro de operações |
| P-12 | Currículo / carta (D-08 em aberto) | Planejado | Candidato | Complementar candidatura, se o PO exigir | Consentimento e/ou execução de contrato | Prazo da vaga + exclusão sob demanda | Alto | Consentimento; direitos do titular; Storage |
| P-13 | Empresas (`name`, `website`, `description`, `logo_path`) | Migration | Em geral pessoa jurídica | Catálogo e vagas | Não é dado pessoal se for só PJ; vira pessoal se identificar pessoa física | Enquanto a empresa existir no catálogo | Baixo a médio | RLS admin; não misturar com perfil |
| P-14 | Vagas públicas (`title`, `description`, `stack`, `level`, `work_model`, `location`, salário no mock) | Protótipo + migration | Em geral não é titular; `location` pode ser | Publicar oportunidade aprovada | Legítimo interesse / contrato com anunciante | Enquanto aprovada; arquivar após encerrar | Médio se descrição citar pessoa | Curadoria; RLS (só `approved` é público) |
| P-15 | `jobs.enriched_description`, `requirements`, `embedding` | Migration + Edge `enrich-job` | Não deve ser titular | Enriquecer vaga e busca V2 | Legítimo interesse do catálogo, **desde que o texto não traga dado de candidato** | Recalcular ao editar; apagar embedding se a vaga for removida | Médio: provedor Gemini processa o texto da vaga | Anonimização para ML; C-04; sem perfil no prompt |
| P-16 | Embedding de **consulta** (texto do perfil → Gemini) | Planejado (`match-jobs`) | Candidato | Score semântico V2 | **Consentimento específico** + C-04; sem isso, não ativar | Não persistir a query; não logar o texto bruto | **Crítico** se ligado sem C-04 | Anonimização para ML; consentimento; C-04 |
| P-17 | Eventos de uso (ver, salvar, candidatar, retirar, retorno da empresa) | Planejado (V3) | Candidato / empresa | Filtragem colaborativa | Consentimento granular por finalidade de recomendação | Agregar/anonimizar; apagar identificadores na revogação | Alto se identificável | Consentimento; anonimização para ML; ADR-001/002 |
| P-18 | Consentimentos (finalidade, versão, data, prova, revogação) | Planejado (gate) | Titular | Base e prova do tratamento | O próprio consentimento (art. 8º) | Prazo de comprovação legal (DPO; em geral anos após o término) | Alto se incompleto | Consentimento granular; registro de operações |
| P-19 | Trilha de auditoria (ator, ação, data, recurso) | Planejado (gate) | Titular e operadores | Segurança e accountability | Legítimo interesse / obrigação legal | Prazo definido pelo DPO (ex.: 6–12 meses operacionais; mais se dever legal) | Médio (contém identificadores) | Registro de operações; minimização |
| P-20 | E-mails transacionais (candidatura, status, aprovação) | Planejado (Resend, Sprint 7) | Candidato / admin | Comunicar o serviço | Execução de contrato; consentimento se marketing | Logs de envio: prazo curto; conteúdo mínimo | Alto (e-mail é identificador) | Consentimento se extra; direitos do titular |
| P-21 | Incidentes (fato, risco, comunicação) | Planejado (gate) | Titulares afetados | Cumprir art. 48 | Obrigação legal | Prazo legal de comprovação | Alto | Notificação de incidentes |

## Tratamentos de IA e terceiros (ainda não ligados)

| Serviço | Dado que o código *prepararia* | Regra atual do backlog | Lacuna |
|---|---|---|---|
| Gemini (`enrich-job`) | Título, descrição e stack da **vaga** | Só textos de vaga fictícios/públicos; sem dado de candidato | Sem C-04, sem log de minimização, sem revisão humana em produção |
| Gemini (`match-jobs`) | `headline` + `bio` + `skills` (ou busca livre) | **Proibido** enviar perfil/e-mail/identificador sem C-04 e gate | Anonimização ausente; embedding de perfil é o maior risco do desenho atual |
| Google OAuth | E-mail, nome, foto do provedor | Auth aprovada; configuração pendente (Sprint 5) | Sem aviso de finalidades nem registro de consentimento |
| Supabase (Auth, DB, Storage) | Conta, perfil, candidatura, avatar | Projeto de desenvolvimento ainda não provisionado | RLS não testada; sem backup/retenção de produção (C-06) |
| Resend | E-mail e evento da mensagem | Só testes para endereços da equipe na fase 1 | Sem base legal fechada para titular real |
| Hospedagem (C-01 em aberto) | IP, logs de acesso (típico) | Sem deploy | Sem política de log nem incidente |

Chaves (`GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` etc.) são **segredos de sistema**, não dados de titular. Devem ficar fora do repositório e de `VITE_*`. O `.env.example` só lista nomes vazios.

## O que a migration já isola (ainda sem ambiente)

- Perfil: leitura/atualização própria ou admin; candidato não atualiza `role`.
- Candidatura: leitura/criação/atualização própria ou admin; só em vaga `approved`.
- Vaga: visitante só vê `approved`; Realtime só em `jobs`, não em perfil/candidatura.
- `match_jobs` opera sobre vagas aprovadas com embedding; a **query** ainda pode carregar texto de perfil antes da RPC.

Isso **não** substitui teste de RLS nem os outros cinco controles.

## Pendências humanas (não inferir)

| ID | Quem | O que falta |
|---|---|---|
| Bases legais | DPO | Aceitar ou trocar cada base candidata da tabela |
| C-04 | DPO + Tech Lead | Política Gemini: dados permitidos, tokens, retenção, região |
| D-01 / D-08 | PO | Campos mínimos do perfil e se currículo/carta entram na candidatura |
| D-09 / P-01 | PO | Cancelar, editar, reabrir candidatura e prazos |
| Protocolo de incidente | DPO + responsável | Plantão, registro, prazo de comunicação à ANPD/titulares |
| Ambiente | Responsável Supabase | Projeto de desenvolvimento sem dado real até o gate |

## Revisão

| Campo | Valor |
|---|---|
| Próximo revisor | DPO |
| Relacionado | Gate LGPD no backlog; ADR-001/002 (fairness; sem atributo sensível no ranking) |
| Atualizar quando | Fechar C-04, D-01, D-08, D-09 ou ligar Auth/Gemini/Resend |
