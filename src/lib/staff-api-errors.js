/** Copy genérica quando o erro de API staff não tem mapa conhecido. */
export const STAFF_API_ERROR_FALLBACK =
  "Não foi possível completar a operação. Tente de novo ou contate a equipe.";

const STAFF_AAL2_ERROR =
  "Confirme o segundo fator na tela anterior (código do autenticador) e tente de novo.";

const STAFF_SESSION_ERROR =
  "Sessão expirada. Saia, entre de novo com e-mail e senha e confirme o autenticador.";

function normalizeStaffErrorText(message) {
  return String(message ?? "")
    .trim()
    .toLowerCase();
}

/** Códigos estáveis embutidos na mensagem PostgREST (substring, fail-closed). */
export function findStableStaffErrorCode(message, stableCodes) {
  const haystack = normalizeStaffErrorText(message);
  if (!haystack) return null;
  return stableCodes.find((code) => haystack.includes(code.toLowerCase())) ?? null;
}

function formatStaffSessionOrAal2(message) {
  const text = String(message ?? "").trim();
  if (text === STAFF_AAL2_ERROR || text === STAFF_SESSION_ERROR) {
    return text;
  }
  if (/aal2|authenticator assurance|mfa challenge|insufficient.*aal/i.test(text)) {
    return STAFF_AAL2_ERROR;
  }
  if (/jwt expired|refresh token/i.test(text)) {
    return STAFF_SESSION_ERROR;
  }
  return null;
}

export function formatStaffPrivilegedApiError(message) {
  const text = String(message ?? "").trim();
  if (text === STAFF_API_ERROR_FALLBACK) {
    return text;
  }
  const sessionOrAal2 = formatStaffSessionOrAal2(text);
  if (sessionOrAal2) return sessionOrAal2;
  return STAFF_API_ERROR_FALLBACK;
}

/** Exceções estáveis de `submit_curation_review` — ver migrations de curadoria. */
export const CURATION_REVIEW_STABLE_CODES = [
  "authentication required",
  "rubric_code is required",
  "job not found",
  "job is not open for curation",
  "cannot review own submission",
  "already reviewed in this round",
  "profile not found",
  "moderation required",
  "round already decided",
  "not authorized to review",
];

export const CURATION_REVIEW_UX_BY_CODE = {
  "authentication required": STAFF_SESSION_ERROR,
  "rubric_code is required": "Selecione um código da rubrica antes de enviar.",
  "job not found": "Vaga não encontrada. Atualize a fila e tente de novo.",
  "job is not open for curation": "Esta vaga não está aberta para parecer (não está pendente).",
  "cannot review own submission":
    "Esta vaga foi enviada por você. Peça a um curador para registrar o parecer.",
  "already reviewed in this round": "Você já registrou parecer nesta rodada para esta vaga.",
  "profile not found": STAFF_API_ERROR_FALLBACK,
  "moderation required": "Esta vaga precisa de moderação antes de novo parecer.",
  "round already decided": "Esta rodada já foi encerrada. Atualize a fila para ver o status atual.",
  "not authorized to review": "Sua conta não pode registrar parecer nesta vaga.",
};

/** RPCs admin na curadoria: prioridade, reenvio, etc. */
export const CURATION_ADMIN_RPC_STABLE_CODES = [
  "admin required",
  "job is not rejected",
  "priority reason required for urgent",
  "job not found",
];

export const CURATION_ADMIN_RPC_UX_BY_CODE = {
  "admin required": "Somente administradores podem executar esta ação.",
  "job is not rejected": "Só é possível reenviar vagas com status rejeitado.",
  "priority reason required for urgent": "Informe o motivo interno ao marcar urgente.",
  "job not found": "Vaga não encontrada. Atualize a fila e tente de novo.",
};

function formatStaffMappedError(message, stableCodes, uxByCode) {
  const sessionOrAal2 = formatStaffSessionOrAal2(message);
  if (sessionOrAal2) return sessionOrAal2;
  const code = findStableStaffErrorCode(message, stableCodes);
  if (code && uxByCode[code]) return uxByCode[code];
  return formatStaffPrivilegedApiError(message);
}

export function formatStaffCurationReviewError(message) {
  return formatStaffMappedError(message, CURATION_REVIEW_STABLE_CODES, CURATION_REVIEW_UX_BY_CODE);
}

export function formatStaffCurationAdminRpcError(message) {
  return formatStaffMappedError(message, CURATION_ADMIN_RPC_STABLE_CODES, CURATION_ADMIN_RPC_UX_BY_CODE);
}

/** Lança copy mapeada. Nunca ecoa message/details/hint de PostgREST. */
export function throwStaffApiError(error) {
  if (!error) return;
  const mapped = new Error(formatStaffPrivilegedApiError(error.message));
  mapped.cause = error;
  throw mapped;
}

export function throwStaffCurationReviewError(error) {
  if (!error) return;
  const mapped = new Error(formatStaffCurationReviewError(error.message));
  mapped.cause = error;
  throw mapped;
}

export function throwStaffCurationAdminRpcError(error) {
  if (!error) return;
  const mapped = new Error(formatStaffCurationAdminRpcError(error.message));
  mapped.cause = error;
  throw mapped;
}
