import { getSupabaseBrowserClient } from "../../lib/supabase-client.js";
import {
  COMMUNITY_PAGE_SIZE,
  isCommunityPublicId,
  mapCommunityDetailRowToDto,
  mapCommunityFeatureStatus,
  mapCommunityListRowToDto,
} from "./community-contract.js";

const COMMUNITY_FUNCTION_UNAVAILABLE = "A Comunidade está indisponível até a aprovação da finalidade de privacidade.";
const GENERIC_ERROR = "Não foi possível carregar a Comunidade. Tente novamente.";

function clientOrThrow(override) {
  const client = override ?? getSupabaseBrowserClient();
  if (!client?.auth?.getSession || !client.rpc) {
    throw new Error("Cliente da Comunidade indisponível.");
  }
  return client;
}

async function authenticatedClient(override) {
  const client = clientOrThrow(override);
  const { data, error } = await client.auth.getSession();
  if (error || !data?.session?.user?.id) throw new Error("Entre na sua conta para acessar a Comunidade.");
  return client;
}

function safeRpcError(error) {
  const message = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");
  if (message.includes("community approval pending") || message.includes("community purpose not authorized")) {
    return new Error(COMMUNITY_FUNCTION_UNAVAILABLE);
  }
  if (message.includes("community rate limit exceeded") || code === "PT429") {
    return new Error("Você fez muitas consultas à Comunidade. Aguarde um minuto e tente novamente.");
  }
  if (message.includes("community profile not found")) return new Error("Perfil não encontrado na Comunidade.");
  if (message.includes("authentication required")) return new Error("Entre na sua conta para acessar a Comunidade.");
  return new Error(GENERIC_ERROR);
}

function throwIfRpcError(error) {
  if (error) throw safeRpcError(error);
}

function normalizePageOptions({ limit = COMMUNITY_PAGE_SIZE, cursor = null } = {}) {
  const pageLimit = Number.isFinite(Number(limit)) ? Math.trunc(Number(limit)) : COMMUNITY_PAGE_SIZE;
  const boundedLimit = Math.min(Math.max(pageLimit, 1), COMMUNITY_PAGE_SIZE);
  if (cursor == null) return { limit: boundedLimit, cursor: null };
  if (
    typeof cursor !== "object" ||
    !isCommunityPublicId(cursor.publicId) ||
    typeof cursor.publishedAt !== "string" ||
    !Number.isFinite(Date.parse(cursor.publishedAt))
  ) {
    throw new Error("Cursor da Comunidade inválido.");
  }
  return { limit: boundedLimit, cursor };
}

export async function loadMyCommunityPublicationStatus(clientOverride) {
  const client = await authenticatedClient(clientOverride);
  const { data, error } = await client.rpc("get_community_feature_status");
  throwIfRpcError(error);
  return mapCommunityFeatureStatus(data);
}

export async function listCommunityProfiles(options = {}, clientOverride) {
  const client = await authenticatedClient(clientOverride);
  const { limit, cursor } = normalizePageOptions(options);
  const { data, error } = await client.rpc("list_community_profiles", {
    p_limit: limit,
    p_before_id: cursor?.publicId ?? null,
    p_before_published_at: cursor?.publishedAt ?? null,
  });
  throwIfRpcError(error);
  if (!Array.isArray(data)) throw new Error(GENERIC_ERROR);
  const items = data.map(mapCommunityListRowToDto);
  const last = items.at(-1);
  return {
    items,
    nextCursor: items.length === limit && last
      ? { publishedAt: last.publishedAt, publicId: last.publicId }
      : null,
  };
}

export async function getCommunityProfile(publicId, clientOverride) {
  if (!isCommunityPublicId(publicId)) throw new Error("Perfil não encontrado na Comunidade.");
  const client = await authenticatedClient(clientOverride);
  const { data, error } = await client.rpc("get_community_profile", { p_public_id: publicId });
  throwIfRpcError(error);
  if (data == null) throw new Error("Perfil não encontrado na Comunidade.");
  return mapCommunityDetailRowToDto(data);
}

export const loadCommunityProfile = getCommunityProfile;

export async function setCommunityProfilePublished(published, clientOverride) {
  if (typeof published !== "boolean") throw new Error("Escolha de compartilhamento inválida.");
  const client = await authenticatedClient(clientOverride);
  const { data, error } = await client.rpc("set_community_profile_publication", { p_published: published });
  throwIfRpcError(error);
  // The SQL boolean is an operation acknowledgement (true), not the new state.
  if (data !== true) throw new Error(GENERIC_ERROR);
  return published;
}

export function revokeCommunityProfile(clientOverride) {
  return setCommunityProfilePublished(false, clientOverride);
}

export async function getCommunityAvatar(publicId, clientOverride) {
  if (!isCommunityPublicId(publicId)) throw new Error("Perfil não encontrado na Comunidade.");
  const client = await authenticatedClient(clientOverride);
  if (!client.functions?.invoke) throw new Error(GENERIC_ERROR);
  const { data, error } = await client.functions.invoke(
    `community-avatar?publicId=${encodeURIComponent(publicId)}`,
    { method: "GET", responseType: "blob" },
  );
  throwIfRpcError(error);
  if (!(data instanceof Blob) || !/^image\/(jpeg|png|webp)$/.test(data.type)) throw new Error(GENERIC_ERROR);
  return data;
}

export const loadCommunityAvatar = getCommunityAvatar;
export const setMyCommunityPublication = setCommunityProfilePublished;

export { COMMUNITY_PAGE_SIZE };
