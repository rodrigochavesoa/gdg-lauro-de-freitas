import { describe, expect, it } from "vitest";
import { isD01Complete, validateOnboarding } from "./profile-completeness.js";

describe("isD01Complete", () => {
  const complete = {
    full_name: "Ana Demo",
    skills: ["React"],
    preferences: {
      experience_level: "mid",
      work_model: "remote",
      location: "Brasil",
    },
  };

  it("exige nome, e-mail, nível, stack, localidade e modalidade", () => {
    expect(isD01Complete(complete, "ana@example.invalid")).toBe(true);
    expect(isD01Complete(complete, "")).toBe(false);
    expect(isD01Complete({ ...complete, skills: [] }, "ana@example.invalid")).toBe(false);
  });
});

describe("validateOnboarding", () => {
  it("recusa payload vazio", () => {
    expect(validateOnboarding({}).errors.length).toBeGreaterThan(0);
  });

  it("aceita D-01 mínimo", () => {
    const result = validateOnboarding({
      fullName: "Ana Demo",
      experienceLevel: "junior",
      skillsText: "React, Node.js",
      location: "Salvador",
      workModel: "hybrid",
    });
    expect(result.errors).toEqual([]);
    expect(result.skills).toEqual(["React", "Node.js"]);
  });
});
