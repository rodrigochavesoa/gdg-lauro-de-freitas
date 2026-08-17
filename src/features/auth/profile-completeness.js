const LEVELS = new Set(["intern", "junior", "mid", "senior"]);
const WORK_MODELS = new Set(["remote", "hybrid", "onsite"]);

export function profilePreferences(profile) {
  const raw = profile?.preferences;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

export function isCandidateProfile(profile) {
  return !profile?.role || profile.role === "candidate";
}

/** Completude D-01. E-mail vem do Auth, não do json de perfil. */
export function isD01Complete(profile, email) {
  if (!profile) return false;
  const prefs = profilePreferences(profile);
  const skills = Array.isArray(profile.skills) ? profile.skills : [];
  return Boolean(
    String(profile.full_name ?? "").trim() &&
      String(email ?? "").trim() &&
      LEVELS.has(prefs.experience_level) &&
      skills.some((item) => String(item).trim()) &&
      String(prefs.location ?? "").trim() &&
      WORK_MODELS.has(prefs.work_model),
  );
}

export function validateOnboarding({
  fullName,
  experienceLevel,
  skillsText,
  location,
  workModel,
}) {
  const errors = [];
  if (!String(fullName ?? "").trim()) errors.push("Nome é obrigatório.");
  if (!LEVELS.has(experienceLevel)) errors.push("Nível de experiência é obrigatório.");
  const skills = String(skillsText ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (skills.length < 1) errors.push("Informe ao menos uma tecnologia.");
  if (!String(location ?? "").trim()) errors.push("Localidade é obrigatória.");
  if (!WORK_MODELS.has(workModel)) errors.push("Modalidade de trabalho é obrigatória.");
  return { errors, skills };
}
