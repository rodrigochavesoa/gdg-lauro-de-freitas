import { getSupabaseBrowserClient } from "../../lib/supabase-client.js";

function clientOrThrow() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error("VITE_SUPABASE_URL e chave publishable/anon não configuradas.");
  }
  return client;
}

function throwIfError(error) {
  if (error) {
    throw new Error(formatStaffMfaUserMessage(error.message || "Falha na API do Supabase."));
  }
}

/** Só o valor explícito `"true"` liga o gate MFA staff. Ausente/false/inválido = fluxo atual. */
export function isStaffMfaRequired(value = import.meta.env.VITE_STAFF_MFA_REQUIRED) {
  return value === "true";
}

/** QR do autenticador só como `src` de imagem (data URL ou https). Nunca HTML. */
export function staffMfaQrSrc(qrCode) {
  const value = String(qrCode ?? "").trim();
  if (!value) return "";
  if (value.startsWith("data:image/")) return value;
  if (/^https:\/\//i.test(value)) return value;
  if (value.startsWith("<svg")) {
    return `data:image/svg+xml;utf-8,${encodeURIComponent(value)}`;
  }
  return "";
}

export function needsStaffMfaStep(assurance) {
  return Boolean(assurance) && assurance.currentLevel !== "aal2";
}

/** Mensagens em PT para erros comuns de enroll/verify TOTP (Preview/homolog). */
export function formatStaffMfaUserMessage(message) {
  const text = String(message ?? "").trim();
  if (!text) return "Não foi possível confirmar o segundo fator. Tente novamente.";
  if (/invalid.*(otp|totp|code)|mfa.*invalid|verification.*failed/i.test(text)) {
    return "Código inválido ou expirado. Abra o autenticador e digite o código atual de 6 dígitos.";
  }
  if (/factor.*not found|no such factor/i.test(text)) {
    return "Autenticador não encontrado nesta conta. Gere um novo QR ou peça ajuda à equipe.";
  }
  return text;
}

/** Erros de API staff quando o JWT ainda está em AAL1 (sessão sem TOTP confirmado). */
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

export async function getStaffMfaAssurance() {
  const client = clientOrThrow();
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  throwIfError(error);
  const { data: factors, error: factorError } = await client.auth.mfa.listFactors();
  throwIfError(factorError);
  const verifiedTotp = (factors?.totp ?? []).filter((factor) => factor.status === "verified");
  return {
    currentLevel: data?.currentLevel ?? "aal1",
    nextLevel: data?.nextLevel ?? "aal1",
    verifiedTotp,
  };
}

export async function enrollStaffTotp() {
  const client = clientOrThrow();
  const { data, error } = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "GDG Jobs",
  });
  throwIfError(error);
  return {
    factorId: data.id,
    qrCode: data.totp?.qr_code ?? "",
    secret: data.totp?.secret ?? "",
  };
}

export async function verifyStaffTotp({ factorId, code }) {
  const client = clientOrThrow();
  const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId });
  throwIfError(challengeError);
  const { data, error } = await client.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: String(code ?? "").trim(),
  });
  throwIfError(error);
  return data;
}
