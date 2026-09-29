import { invalidateAvatarSignedUrl } from "../../features/auth/auth-api.js";
import { invalidateMyApplicationsCache } from "../../features/jobs/apply-api.js";
import { invalidatePrivacyPreferencesCache } from "../../features/privacy/privacy-api.js";

/**
 * Limpa caches com dado do usuário (candidaturas, privacidade, signed URL do avatar).
 * Sem `userId`, limpa todas as chaves — logout. Com `userId`, só esse usuário — troca de sessão.
 * Catálogo público não entra aqui.
 */
export function invalidateSessionCaches(userId) {
  invalidateMyApplicationsCache(userId);
  invalidatePrivacyPreferencesCache(userId);
  invalidateAvatarSignedUrl(userId);
}
