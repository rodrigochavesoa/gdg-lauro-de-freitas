const LEVEL_VALUES = ["intern", "junior", "mid", "senior"];
const WORK_MODEL_VALUES = ["remote", "hybrid", "onsite"];

export function filterCommunityProfiles(profiles, { query = "", experienceLevel = "", workModel = "" } = {}) {
  const normalizedQuery = String(query).trim().toLowerCase();
  return (profiles ?? []).filter((profile) => {
    if (experienceLevel && profile.experienceLevel !== experienceLevel) return false;
    if (workModel && profile.workModel !== workModel) return false;
    if (!normalizedQuery) return true;
    const haystack = [
      profile.fullName,
      profile.headline,
      profile.location,
      ...(profile.skills ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export function formatCommunityLoadedCount(visibleCount, hasMorePages) {
  if (visibleCount < 1) return "Nenhum perfil nesta busca";
  if (hasMorePages) {
    return visibleCount === 1 ? "1 perfil carregado (há mais)" : `${visibleCount} perfis carregados (há mais)`;
  }
  return visibleCount === 1 ? "1 perfil compartilhado" : `${visibleCount} perfis compartilhados`;
}

const LEVEL_LABELS = { intern: "Estágio", junior: "Júnior", mid: "Pleno", senior: "Sênior" };
const WORK_MODEL_LABELS = { remote: "Remoto", hybrid: "Híbrido", onsite: "Presencial" };

export const COMMUNITY_LEVEL_FILTER_OPTIONS = [
  { value: "", label: "Todos os níveis" },
  ...LEVEL_VALUES.map((value) => ({ value, label: LEVEL_LABELS[value] })),
];

export const COMMUNITY_WORK_MODEL_FILTER_OPTIONS = [
  { value: "", label: "Qualquer modalidade" },
  ...WORK_MODEL_VALUES.map((value) => ({ value, label: WORK_MODEL_LABELS[value] })),
];
