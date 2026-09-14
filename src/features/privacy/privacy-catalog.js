export const PRIVACY_PURPOSES = [
  {
    purpose_code: "F-01",
    version: 1,
    title: "Criar e proteger sua conta",
    specific_description: "Usar dados mínimos de autenticação para criar seu acesso, proteger a conta e ligá-la ao seu perfil.",
    classification: "necessary_notice",
    status: "active",
    legal_basis_status: "pending_dpo",
    retention_status: "pending_dpo",
    text_status: "pending_dpo",
    revocation_effect: "Excluir a conta encerra o acesso; registros que precisarem ser mantidos seguirão a retenção aprovada.",
  },
  {
    purpose_code: "F-02",
    version: 1,
    title: "Manter seu perfil profissional",
    specific_description: "Guardar os dados que você escolheu preencher para consultar, corrigir e usar seu perfil no GDG Jobs.",
    classification: "necessary_notice",
    status: "active",
    legal_basis_status: "pending_dpo",
    retention_status: "pending_dpo",
    text_status: "pending_dpo",
    revocation_effect: "Você pode corrigir ou remover campos opcionais; o perfil pode ficar menos completo sem impedir o uso básico.",
  },
  {
    purpose_code: "F-03",
    version: 1,
    title: "Receber e acompanhar uma candidatura",
    specific_description: "Registrar sua candidatura e compartilhar o snapshot permitido com a empresa anunciante da vaga.",
    classification: "necessary_notice",
    status: "active",
    legal_basis_status: "pending_dpo",
    retention_status: "pending_dpo",
    text_status: "pending_dpo",
    revocation_effect: "Retirar a candidatura interrompe as próximas etapas permitidas; registros sujeitos a retenção aprovada podem permanecer.",
  },
  {
    purpose_code: "F-04",
    version: 1,
    title: "Receber notificações essenciais",
    specific_description: "Informar mudanças de status, segurança e acontecimentos indispensáveis à sua conta ou candidatura.",
    classification: "necessary_notice",
    status: "inactive",
    legal_basis_status: "pending_dpo",
    retention_status: "pending_dpo",
    text_status: "pending_dpo",
    revocation_effect: "Quando houver canal alternativo aprovado, você poderá ajustar a preferência; mensagens indispensáveis continuam necessárias.",
  },
  {
    purpose_code: "F-05",
    version: 1,
    title: "Receber a GDG Jobs Letter",
    specific_description: "Enviar novidades, oportunidades e conteúdo editorial da comunidade por e-mail.",
    classification: "optional_consent",
    status: "inactive",
    legal_basis_status: "pending_dpo",
    retention_status: "pending_dpo",
    text_status: "pending_dpo",
    revocation_effect: "Descadastrar-se impede novos envios e mantém somente a prova mínima necessária para evitar envio indevido.",
  },
  {
    purpose_code: "F-06",
    version: 1,
    title: "Receber recomendações com base no perfil",
    specific_description: "Usar skills, nível, localidade, modalidade e preferências para sugerir vagas relevantes.",
    classification: "optional_consent",
    status: "active",
    legal_basis_status: "pending_dpo",
    retention_status: "pending_dpo",
    text_status: "pending_dpo",
    revocation_effect: "Desligar remove recomendações personalizadas futuras; catálogo, busca, filtros e candidatura continuam disponíveis.",
  },
  {
    purpose_code: "F-07",
    version: 1,
    title: "Melhorar recomendações com eventos de uso",
    specific_description: "Usar eventos mínimos, como vagas vistas ou salvas, para avaliar relevância e apoiar recomendações futuras.",
    classification: "optional_consent",
    status: "inactive",
    legal_basis_status: "pending_dpo",
    retention_status: "pending_dpo",
    text_status: "pending_dpo",
    revocation_effect: "Desligar interrompe a coleta para recomendação e remove identificadores dos eventos quando possível.",
  },
  {
    purpose_code: "F-08",
    version: 1,
    title: "Calcular matching semântico com Gemini",
    specific_description: "Enviar somente campos profissionais minimizados a Gemini para calcular proximidade com vagas aprovadas.",
    classification: "optional_consent",
    status: "inactive",
    legal_basis_status: "pending_dpo",
    retention_status: "pending_dpo",
    text_status: "pending_dpo",
    revocation_effect: "Novos envios são bloqueados e derivados devem ser descartados conforme a política aprovada.",
  },
  {
    purpose_code: "F-09",
    version: 1,
    title: "Enriquecer vagas com Gemini",
    specific_description: "Gerar rascunhos estruturados a partir do texto da vaga, mantendo o texto original como fonte editorial.",
    classification: "optional_consent",
    status: "inactive",
    legal_basis_status: "pending_dpo",
    retention_status: "pending_dpo",
    text_status: "pending_dpo",
    revocation_effect: "A vaga pode ser publicada sem enriquecimento; remover a vaga deve impedir novos processamentos e eliminar derivados aprovados.",
  },
  {
    purpose_code: "F-10",
    version: 1,
    title: "Proteger e operar o serviço",
    specific_description: "Registrar sinais técnicos mínimos para detectar erros, abuso e indisponibilidade, sem guardar payloads pessoais completos.",
    classification: "necessary_notice",
    status: "active",
    legal_basis_status: "pending_dpo",
    retention_status: "pending_dpo",
    text_status: "pending_dpo",
    revocation_effect: "A camada estritamente necessária de segurança não é desligada; métricas opcionais devem ser separadas e revogáveis.",
  },
];

export const OPTIONAL_PURPOSE = "optional_consent";
export const NECESSARY_NOTICE = "necessary_notice";

export function latestEventsByPurpose(events = []) {
  return events.reduce((result, event) => {
    if (!result[event.purpose_code]) result[event.purpose_code] = event;
    return result;
  }, {});
}

export function isPurposeAuthorized(purpose, event) {
  if (!purpose || purpose.status !== "active") return false;
  if (purpose.classification === NECESSARY_NOTICE) return true;
  return (
    event?.purpose_version === purpose.version &&
    purpose.legal_basis_status === "approved" &&
    purpose.retention_status === "approved" &&
    purpose.text_status === "approved" &&
    event?.event_type === "accepted"
  );
}

export function currentPurposeState(purpose, event) {
  const currentVersion = event?.purpose_version === purpose?.version;
  return {
    currentEvent: currentVersion ? event : null,
    choice: currentVersion ? event?.event_type ?? "not_recorded" : "not_recorded",
    authorized: isPurposeAuthorized(purpose, event),
  };
}
