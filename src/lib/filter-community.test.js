import { describe, expect, it } from "vitest";
import { filterCommunityProfiles, formatCommunityLoadedCount } from "./filter-community.js";

const sample = [
  {
    publicId: "2e2fbaf7-e292-4c5d-8b77-928639845e01",
    fullName: "Ana Example",
    headline: "Front-end",
    skills: ["React", "CSS"],
    location: "Salvador, BA",
    experienceLevel: "junior",
    workModel: "remote",
  },
  {
    publicId: "3f3fcbf8-f3a3-5d6e-9c88-039740956f12",
    fullName: "Bruno Silva",
    headline: "Back-end",
    skills: ["Node"],
    location: "Lauro de Freitas, BA",
    experienceLevel: "mid",
    workModel: "hybrid",
  },
];

describe("filterCommunityProfiles", () => {
  it("filters by query across name, skills and location", () => {
    expect(filterCommunityProfiles(sample, { query: "react" })).toHaveLength(1);
    expect(filterCommunityProfiles(sample, { query: "lauro" })).toHaveLength(1);
  });

  it("combines level and work model filters", () => {
    expect(filterCommunityProfiles(sample, { experienceLevel: "mid", workModel: "hybrid" })).toHaveLength(1);
    expect(filterCommunityProfiles(sample, { experienceLevel: "junior", workModel: "hybrid" })).toHaveLength(0);
  });
});

describe("formatCommunityLoadedCount", () => {
  it("avoids exact totals when more pages exist", () => {
    expect(formatCommunityLoadedCount(24, true)).toBe("24 perfis carregados (há mais)");
  });
});
