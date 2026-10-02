/** Modelo estático do orçamento de leitura da Comunidade (UX-COMMUNITY-PROFILES-01). */

export const COMMUNITY_READ_BUDGET_PER_MINUTE = 60;
export const COMMUNITY_PAGE_SIZE = 24;
export const COMMUNITY_AVATAR_PREFETCH_CONCURRENCY = 6;
export const COMMUNITY_EAGER_AVATAR_CARDS = 12;

/**
 * Cada visita à listagem consome 1 (status) + 1 (lista) no orçamento compartilhado.
 * Cada proxy community-avatar consome 1 via RPC community_avatar_storage_path no servidor.
 */
export function estimateListVisitBudget({ profilesOnPage = 0, withAvatars = 0 } = {}) {
  const listRpc = 2;
  const avatarProxies = Math.max(0, Math.min(withAvatars, profilesOnPage));
  return {
    listRpc,
    avatarProxies,
    total: listRpc + avatarProxies,
    remainingAfterVisit: COMMUNITY_READ_BUDGET_PER_MINUTE - (listRpc + avatarProxies),
  };
}

export function estimatePrefetchWaves(avatarCount) {
  const n = Math.max(0, avatarCount);
  const waves = n === 0 ? 0 : Math.ceil(n / COMMUNITY_AVATAR_PREFETCH_CONCURRENCY);
  return { avatarCount: n, concurrency: COMMUNITY_AVATAR_PREFETCH_CONCURRENCY, waves };
}

export function classifyBudgetRisk(totalReadsInWindow) {
  const used = Number(totalReadsInWindow);
  if (!Number.isFinite(used) || used < 0) return "unknown";
  const ratio = used / COMMUNITY_READ_BUDGET_PER_MINUTE;
  if (ratio >= 1) return "over_limit";
  if (ratio >= 0.85) return "high";
  if (ratio >= 0.6) return "moderate";
  return "low";
}
