import { describe, expect, it } from "vitest";
import { enrichHandoffTask, renderTaskDescription, storyIdFromTaskName } from "./clickup-task-description.mjs";

describe("renderTaskDescription", () => {
  it("não usa tabelas markdown", () => {
    const md = renderTaskDescription({
      problem: "Problema X",
      objective: "Objetivo Y",
      scope: ["a"],
      dod: ["lint verde"],
    });
    expect(md).not.toMatch(/\|.*\|/);
    expect(md).toContain("## Problema / contexto");
    expect(md).toContain("- [ ] lint verde");
  });
});

describe("enrichHandoffTask", () => {
  it("preenche História ID a partir do nome", () => {
    const t = enrichHandoffTask({
      name: "SEC-DB-FUNCTION-HARDENING-01 — título",
      fields: { PR: "—" },
    });
    expect(t.fields["História ID"]).toBe("SEC-DB-FUNCTION-HARDENING-01");
  });

  it("extrai story id do nome", () => {
    expect(storyIdFromTaskName("UX-ADMIN-JOBS-01 — polish")).toBe("UX-ADMIN-JOBS-01");
  });
});
