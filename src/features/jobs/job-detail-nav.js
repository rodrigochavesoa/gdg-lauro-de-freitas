export const JOB_DETAIL_BACK_DEFAULT = "/vagas";

export function jobDetailBackFrom(from) {
  if (from === "/minhas-candidaturas") return from;
  return JOB_DETAIL_BACK_DEFAULT;
}

export function jobDetailBackLabel(from) {
  return from === "/minhas-candidaturas"
    ? "Voltar para minhas candidaturas"
    : "Voltar para vagas";
}
