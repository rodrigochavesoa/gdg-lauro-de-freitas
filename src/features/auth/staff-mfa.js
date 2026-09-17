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
    throw new Error(error.message || "Falha na API do Supabase.");
  }
}

/** Só o valor explícito `"true"` liga o gate MFA staff. Ausente/false/inválido = fluxo atual. */
export function isStaffMfaRequired(value = import.meta.env.VITE_STAFF_MFA_REQUIRED) {
  return value === "true";
}

export function needsStaffMfaStep(assurance) {
  return Boolean(assurance) && assurance.currentLevel !== "aal2";
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
