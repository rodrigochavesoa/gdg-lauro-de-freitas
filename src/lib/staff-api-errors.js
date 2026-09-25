/** Copy genérica quando o erro de API staff não tem mapa conhecido. */
export const STAFF_API_ERROR_FALLBACK =
  "Não foi possível completar a operação. Tente de novo ou contate a equipe.";

const STAFF_AAL2_ERROR =
  "Confirme o segundo fator na tela anterior (código do autenticador) e tente de novo.";

const STAFF_SESSION_ERROR =
  "Sessão expirada. Saia, entre de novo com e-mail e senha e confirme o autenticador.";

export function formatStaffPrivilegedApiError(message) {
  const text = String(message ?? "").trim();
  if (text === STAFF_AAL2_ERROR || text === STAFF_SESSION_ERROR || text === STAFF_API_ERROR_FALLBACK) {
    return text;
  }
  if (/aal2|authenticator assurance|mfa challenge|insufficient.*aal/i.test(text)) {
    return STAFF_AAL2_ERROR;
  }
  if (/jwt expired|refresh token/i.test(text)) {
    return STAFF_SESSION_ERROR;
  }
  return STAFF_API_ERROR_FALLBACK;
}

/** Lança copy mapeada. Nunca ecoa message/details/hint de PostgREST. */
export function throwStaffApiError(error) {
  if (!error) return;
  const mapped = new Error(formatStaffPrivilegedApiError(error.message));
  mapped.cause = error;
  throw mapped;
}
