import { requireRowFields } from "../../lib/data-contracts/map-row.js";

export const COMMUNITY_PAGE_SIZE = 24;

const PUBLIC_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LIST_FIELDS = [
  "public_id",
  "full_name",
  "headline",
  "skills",
  "location",
  "experience_level",
  "work_model",
  "avatar_available",
  "published_at",
];
const DETAIL_FIELDS = [...LIST_FIELDS, "bio", "linkedin_url", "github_url", "portfolio_url"];

export function isCommunityPublicId(value) {
  return typeof value === "string" && PUBLIC_ID_PATTERN.test(value);
}

function projectCommunityRow(row, fields, surface) {
  requireRowFields(row, fields, surface);
  if (!isCommunityPublicId(row.public_id)) {
    throw new Error(`contrato de dados: identificador público inválido (${surface}.public_id)`);
  }
  if (typeof row.avatar_available !== "boolean") {
    throw new Error(`contrato de dados: campo obrigatório inválido (${surface}.avatar_available)`);
  }
  return {
    publicId: row.public_id,
    fullName: row.full_name,
    headline: row.headline ?? null,
    skills: Array.isArray(row.skills) ? row.skills.filter((skill) => typeof skill === "string") : [],
    location: row.location ?? null,
    experienceLevel: row.experience_level ?? null,
    workModel: row.work_model ?? null,
    avatarAvailable: row.avatar_available,
    publishedAt: row.published_at,
    ...(fields === DETAIL_FIELDS
      ? {
          bio: row.bio ?? null,
          linkedinUrl: row.linkedin_url ?? null,
          githubUrl: row.github_url ?? null,
          portfolioUrl: row.portfolio_url ?? null,
        }
      : {}),
  };
}

export function mapCommunityListRowToDto(row) {
  return projectCommunityRow(row, LIST_FIELDS, "community.list");
}

export function mapCommunityDetailRowToDto(row) {
  return projectCommunityRow(row, DETAIL_FIELDS, "community.detail");
}

export function mapCommunityFeatureStatus(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("contrato de dados: status da Comunidade inválido");
  }
  if (value.available === false && value.reason === "approval_pending") {
    return { published: false, canPublish: false, reasonCode: "approval_pending" };
  }
  if (
    value.available === true &&
    value.reason === null &&
    typeof value.published === "boolean" &&
    typeof value.can_publish === "boolean"
  ) {
    return {
      published: value.published,
      canPublish: value.can_publish,
      reasonCode: value.can_publish ? (value.published ? null : "consent_required") : "profile_incomplete",
    };
  }
  throw new Error("contrato de dados: status da Comunidade inválido");
}
