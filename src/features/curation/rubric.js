/** Códigos D-04 — obrigatórios na RPC. Comentário interno é opcional. */
export const RUBRIC_OPTIONS = [
  {
    code: "R1-empresa-identificavel",
    label: "Empresa e oportunidade identificáveis",
  },
  {
    code: "R2-descricao-completa",
    label: "Descrição com responsabilidades, requisitos, nível e localidade",
  },
  {
    code: "R3-sem-discriminacao",
    label: "Sem exigências discriminatórias ou conteúdo enganoso",
  },
  {
    code: "R4-canal-candidatura",
    label: "Canal de candidatura definido no GDGJobs",
  },
  {
    code: "R5-vaga-tech-ativa",
    label: "Vaga ativa e relacionada à área tech",
  },
];

export function validateCurationReview({ decision, rubricCode }) {
  const errors = [];
  if (decision !== "approve" && decision !== "reject") {
    errors.push("Escolha aprovar ou rejeitar.");
  }
  if (!String(rubricCode ?? "").trim()) {
    errors.push("Código da rubrica é obrigatório.");
  }
  return errors;
}

export function validateUrgentPriority(reason) {
  if (!String(reason ?? "").trim()) {
    return "Motivo interno é obrigatório para prioridade urgente.";
  }
  return "";
}
