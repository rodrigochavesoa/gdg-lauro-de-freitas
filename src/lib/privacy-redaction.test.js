import { describe, expect, it } from "vitest";
import { FORBIDDEN_LOG_KEYS, findForbiddenLogFields, redactForLog } from "./privacy-redaction.js";

const FORBIDDEN_FIXTURE = {
  actor_id: "user-1",
  email: "candidate@example.com",
  bio: "texto profissional completo",
  cv_url: "https://files.example/cv.pdf",
  snapshot: { full_name: "Ana", skills: ["React"] },
  prompt: "envie o perfil para o Gemini",
  response: "resposta bruta do modelo",
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload",
  access_token: "secret-token",
  resend: { html: "<p>payload</p>", to: ["a@b.c"] },
  nested: {
    authorization: "Bearer abc",
    cv: "conteudo",
  },
};

describe("privacy redaction", () => {
  it("lista os campos proibidos da matriz §5.2", () => {
    expect(FORBIDDEN_LOG_KEYS).toEqual(expect.arrayContaining([
      "email",
      "bio",
      "cv",
      "cv_url",
      "snapshot",
      "prompt",
      "response",
      "token",
      "access_token",
      "refresh_token",
      "authorization",
      "resend",
      "html",
    ]));
  });

  it("falha se o payload de log ainda contém campos proibidos", () => {
    expect(findForbiddenLogFields(FORBIDDEN_FIXTURE)).toEqual(expect.arrayContaining([
      "email",
      "bio",
      "cv_url",
      "snapshot",
      "prompt",
      "response",
      "token",
      "access_token",
      "resend",
      "authorization",
      "cv",
    ]));
  });

  it("remove PII, snapshot, prompt, token e payload de Resend do log", () => {
    const redacted = redactForLog(FORBIDDEN_FIXTURE);
    expect(findForbiddenLogFields(redacted)).toEqual([]);
    expect(redacted).toMatchObject({ actor_id: "user-1" });
    expect(redacted).not.toHaveProperty("email");
    expect(redacted.nested).not.toHaveProperty("authorization");
  });

  it("não diferencia falta de autorização expondo conteúdo profissional", () => {
    const redacted = redactForLog({
      result: "blocked",
      reason: "purpose_not_authorized",
      bio: "senior React em Salvador",
      skills: ["React", "Node"],
    });
    expect(redacted).toMatchObject({
      result: "blocked",
      reason: "purpose_not_authorized",
    });
    expect(findForbiddenLogFields(redacted)).toEqual([]);
    expect(JSON.stringify(redacted)).not.toMatch(/React|Salvador|senior/i);
  });
});
