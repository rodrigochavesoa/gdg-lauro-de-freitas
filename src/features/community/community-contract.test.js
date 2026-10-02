import { describe, expect, it } from "vitest";
import {
  mapCommunityFeatureStatus,
  mapCommunityDetailRowToDto,
  mapCommunityListRowToDto,
} from "./community-contract.js";

const listRow = {
  public_id: "2e2fbaf7-e292-4c5d-8b77-928639845e01",
  full_name: "Ana Example",
  headline: "Desenvolvedora Front-end",
  skills: ["React", "CSS"],
  location: "Salvador, BA",
  experience_level: "junior",
  work_model: "remote",
  avatar_available: true,
  published_at: "2026-10-01T12:00:00.000Z",
  email: "private@example.test",
  role: "admin",
  avatar_path: "private-uid/photo.jpg",
  preferences: { cv_url: "https://private.example.test/cv" },
  id: "private-auth-uid",
};

describe("community profile contract", () => {
  it("projects only allowlisted list fields, dropping private or extra columns", () => {
    const dto = mapCommunityListRowToDto(listRow);

    expect(dto).toEqual({
      publicId: "2e2fbaf7-e292-4c5d-8b77-928639845e01",
      fullName: "Ana Example",
      headline: "Desenvolvedora Front-end",
      skills: ["React", "CSS"],
      location: "Salvador, BA",
      experienceLevel: "junior",
      workModel: "remote",
      avatarAvailable: true,
      publishedAt: "2026-10-01T12:00:00.000Z",
    });
    expect(JSON.stringify(dto)).not.toMatch(/email|role|avatar_path|preferences|private-auth-uid|cv_url/i);
  });

  it("projects the detail allowlist, including public links only", () => {
    expect(
      mapCommunityDetailRowToDto({
        ...listRow,
        bio: "Sobre a profissional.",
        linkedin_url: "https://www.linkedin.com/in/ana-example",
        github_url: "https://github.com/ana-example",
        portfolio_url: "https://ana.example.test",
        secret: "must not leak",
      }),
    ).toEqual({
      publicId: "2e2fbaf7-e292-4c5d-8b77-928639845e01",
      fullName: "Ana Example",
      headline: "Desenvolvedora Front-end",
      skills: ["React", "CSS"],
      location: "Salvador, BA",
      experienceLevel: "junior",
      workModel: "remote",
      avatarAvailable: true,
      publishedAt: "2026-10-01T12:00:00.000Z",
      bio: "Sobre a profissional.",
      linkedinUrl: "https://www.linkedin.com/in/ana-example",
      githubUrl: "https://github.com/ana-example",
      portfolioUrl: "https://ana.example.test",
    });
  });

  it("models the pending DPO gate without returning any profile fields", () => {
    expect(mapCommunityFeatureStatus({ available: false, reason: "approval_pending", published: false, full_name: "private" }))
      .toEqual({ published: false, canPublish: false, reasonCode: "approval_pending" });
  });

  it("rejects missing contract fields and malformed public identifiers", () => {
    expect(() => mapCommunityListRowToDto({ ...listRow, public_id: "" })).toThrow(/contrato de dados/i);
    expect(() => mapCommunityDetailRowToDto({ ...listRow, bio: undefined })).toThrow(/contrato de dados/i);
  });
});
