import { describe, expect, it } from "vitest";
import {
  PRIVACY_PURPOSES,
  currentPurposeState,
  isPurposeAuthorized,
  latestEventsByPurpose,
} from "./privacy-catalog.js";

describe("privacy catalog", () => {
  it("mantém as dez finalidades estáveis e versionadas", () => {
    expect(PRIVACY_PURPOSES).toHaveLength(10);
    expect(PRIVACY_PURPOSES.map((purpose) => purpose.purpose_code)).toEqual([
      "F-01", "F-02", "F-03", "F-04", "F-05", "F-06", "F-07", "F-08", "F-09", "F-10",
    ]);
    expect(PRIVACY_PURPOSES.every((purpose) => purpose.version === 1)).toBe(true);
    expect(PRIVACY_PURPOSES.every((purpose) => purpose.revocation_effect)).toBe(true);
  });

  it("não autoriza finalidade opcional com estados pending_dpo", () => {
    const recommendation = PRIVACY_PURPOSES.find((purpose) => purpose.purpose_code === "F-06");
    expect(isPurposeAuthorized(recommendation, { event_type: "accepted" })).toBe(false);
    expect(isPurposeAuthorized(recommendation, { event_type: "refused" })).toBe(false);
  });

  it("mantém avisos necessários ativos sem tratá-los como opt-in", () => {
    const account = PRIVACY_PURPOSES.find((purpose) => purpose.purpose_code === "F-01");
    expect(isPurposeAuthorized(account, null)).toBe(true);
    expect(currentPurposeState(account, null)).toMatchObject({ choice: "not_recorded", authorized: true });
  });

  it("não considera finalidade inativa autorizável", () => {
    const newsletter = PRIVACY_PURPOSES.find((purpose) => purpose.purpose_code === "F-05");
    expect(newsletter.status).toBe("inactive");
    expect(isPurposeAuthorized(newsletter, { event_type: "accepted" })).toBe(false);
  });

  it("não reaproveita aceite de versão anterior", () => {
    const recommendation = PRIVACY_PURPOSES.find((purpose) => purpose.purpose_code === "F-06");
    const historicalEvent = { purpose_code: "F-06", purpose_version: 0, event_type: "accepted" };
    expect(isPurposeAuthorized(recommendation, historicalEvent)).toBe(false);
    expect(currentPurposeState(recommendation, historicalEvent).choice).toBe("not_recorded");
  });

  it("seleciona o evento mais recente por finalidade sem expor dados do perfil", () => {
    const events = [
      { purpose_code: "F-06", event_type: "accepted", created_at: "2026-09-13T10:00:00Z" },
      { purpose_code: "F-06", event_type: "revoked", created_at: "2026-09-13T11:00:00Z" },
      { purpose_code: "F-01", event_type: "notice", created_at: "2026-09-13T09:00:00Z", proof: { source: "preferences" } },
    ];
    const current = latestEventsByPurpose([...events].sort((left, right) => new Date(right.created_at) - new Date(left.created_at)));

    expect(current["F-06"].event_type).toBe("revoked");
    expect(current["F-01"]).not.toHaveProperty("profile");
  });
});
