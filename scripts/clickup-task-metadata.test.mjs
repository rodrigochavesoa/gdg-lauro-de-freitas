import { describe, expect, it } from "vitest";
import {
  appendIntervalToDescription,
  coerceOpenClose,
  findMember,
  normalizeTags,
  parseDefaults,
  parseIsoToEpochMs,
  parseTaskMetadata,
  resolveAssigneeSpec,
  TASK_TAG_TAXONOMY,
} from "./clickup-task-metadata.mjs";

describe("clickup task metadata", () => {
  it("normalizeTags limita 1–3 e só aceita a taxonomia", () => {
    expect(normalizeTags(["Frontend", "UX", "QA", "Frontend", "Nope"])).toEqual([
      "Frontend",
      "UX",
      "QA",
    ]);
    expect(TASK_TAG_TAXONOMY).toContain("Ops humano");
  });

  it("parseDefaults e assignee via env", () => {
    const defaults = parseDefaults({
      defaults: { assignee: { email: "you@example.com" } },
    });
    const spec = resolveAssigneeSpec({
      taskMeta: parseTaskMetadata({}),
      defaults,
      env: { CLICKUP_ASSIGNEE_NAME: "Ada Lovelace" },
    });
    expect(spec.email).toBe("you@example.com");
    expect(spec.name).toBe("Ada Lovelace");
  });

  it("findMember resolve por e-mail ou nome", () => {
    const members = [{ user: { id: 9, username: "Ada Lovelace", email: "ada@example.com" } }];
    expect(findMember(members, { email: "ada@example.com" }).id).toBe(9);
    expect(findMember(members, { name: "Ada" }).id).toBe(9);
    expect(findMember(members, { name: "Ada Lovelace" }).id).toBe(9);
    expect(findMember(members, { email: "nobody@example.com" })).toBeNull();
  });

  it("coerceOpenClose garante aberta ≠ fechada em Done", () => {
    const same = coerceOpenClose("2026-01-10", "2026-01-10", { isDone: true });
    expect(same.close).toBeGreaterThan(same.open);
    expect(parseIsoToEpochMs("2026-01-10")).toBe(Date.UTC(2026, 0, 10, 12, 0, 0));
    expect(parseIsoToEpochMs("1768003200000")).toBe(1768003200000);
    expect(parseIsoToEpochMs(1768003200000)).toBe(1768003200000);
  });

  it("appendIntervalToDescription é idempotente", () => {
    const once = appendIntervalToDescription("Nota", Date.parse("2026-01-10"), Date.parse("2026-01-20"));
    expect(once).toContain("**Intervalo:** 2026-01-10 → 2026-01-20");
    expect(appendIntervalToDescription(once, Date.parse("2026-01-10"), Date.parse("2026-01-20"))).toBe(once);
    const shifted = appendIntervalToDescription(once, Date.UTC(2026, 0, 11, 12), Date.UTC(2026, 0, 21, 12));
    expect(shifted).toContain("**Intervalo:** 2026-01-11 → 2026-01-21");
    expect(shifted.match(/\*\*Intervalo:\*\*/g)).toHaveLength(1);
  });
});
