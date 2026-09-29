import { invalidateAvatarSignedUrl } from "../../features/auth/auth-api.js";
import { invalidateMyApplicationsCache } from "../../features/jobs/apply-api.js";
import { invalidatePrivacyPreferencesCache } from "../../features/privacy/privacy-api.js";
import { invalidateCurationMemory } from "./staff.js";

/**
 * Limpa caches com dado do usuário (candidaturas, privacidade, signed URL do avatar)
 * e a curadoria, cujas chaves não incluem userId.
 * Sem `userId`, limpa todas as chaves de PII — logout. Com `userId`, só esse usuário.
 * A curadoria sai inteira nos dois casos. Catálogo público não entra aqui.
 */
export function invalidateSessionCaches(userId) {
  invalidateMyApplicationsCache(userId);
  invalidatePrivacyPreferencesCache(userId);
  invalidateAvatarSignedUrl(userId);
  invalidateCurationMemory();
}
