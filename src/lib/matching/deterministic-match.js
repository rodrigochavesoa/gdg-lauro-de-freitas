const WORK_MODEL_POINTS = Object.freeze({
  remote: Object.freeze({ remote: 30, hybrid: 15, onsite: 0 }),
  hybrid: Object.freeze({ remote: 15, hybrid: 30, onsite: 0 }),
  onsite: Object.freeze({ remote: 0, hybrid: 0, onsite: 30 }),
});

const SENIORITY_ORDER = Object.freeze(["intern", "junior", "mid", "senior"]);
const WORK_MODEL_LABELS = Object.freeze({
  remote: "Remoto",
  hybrid: "Híbrido",
  onsite: "Presencial",
});
const LEVEL_LABELS = Object.freeze({
  intern: "Estágio",
  junior: "Júnior",
  mid: "Pleno",
  senior: "Sênior",
  lead: "Sênior",
});

function normalizeCriterion(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

function normalizeLevel(value) {
  const level = normalizeCriterion(value);
  return level === "lead" ? "senior" : level;
}

function uniqueValues(values) {
  if (!Array.isArray(values)) return [];
  const unique = new Map();
  for (const value of values) {
    const normalized = normalizeCriterion(value);
    if (normalized && !unique.has(normalized)) unique.set(normalized, String(value).trim());
  }
  return [...unique.entries()];
}

function getSeniorityPoints(candidateLevel, jobLevel) {
  const candidateIndex = SENIORITY_ORDER.indexOf(normalizeLevel(candidateLevel));
  const vacancyIndex = SENIORITY_ORDER.indexOf(normalizeLevel(jobLevel));
  if (candidateIndex < 0 || vacancyIndex < 0) return 0;
  const distance = Math.abs(candidateIndex - vacancyIndex);
  if (distance === 0) return 20;
  if (distance === 1) return 10;
  return 0;
}

function dateValue(value) {
  const timestamp = Date.parse(value ?? "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function compareIds(left, right) {
  const a = String(left ?? "");
  const b = String(right ?? "");
  return a < b ? -1 : a > b ? 1 : 0;
}

function buildMatchReasons({ matchingSkills, stackPoints, candidateWorkModel, jobWorkModel, workModelPoints, candidateLevel, jobLevel, seniorityPoints }) {
  const reasons = [];
  if (stackPoints > 0) {
    reasons.push({
      key: "stack",
      points: stackPoints,
      label: `Tecnologias em comum: ${matchingSkills.join(", ")}`,
    });
  }
  if (workModelPoints > 0) {
    const label = candidateWorkModel === jobWorkModel
      ? `Mesmo regime de trabalho: ${WORK_MODEL_LABELS[jobWorkModel]}`
      : `Regime de trabalho próximo: ${WORK_MODEL_LABELS[candidateWorkModel]} e ${WORK_MODEL_LABELS[jobWorkModel]}`;
    reasons.push({ key: "workModel", points: workModelPoints, label });
  }
  if (seniorityPoints > 0) {
    const normalizedCandidate = normalizeLevel(candidateLevel);
    const normalizedJob = normalizeLevel(jobLevel);
    const label = normalizedCandidate === normalizedJob
      ? `Nível compatível: ${LEVEL_LABELS[normalizedJob]}`
      : `Nível próximo: ${LEVEL_LABELS[normalizedCandidate]} e ${LEVEL_LABELS[normalizedJob]}`;
    reasons.push({ key: "seniority", points: seniorityPoints, label });
  }
  return reasons;
}

/** Calcula afinidade objetiva no cliente; não interpreta o score como chance de contratação. */
export function scoreJobMatch(job, profile) {
  const candidateSkills = uniqueValues(profile?.skills);
  const vacancyStack = uniqueValues(job?.stack);
  const skillSet = new Set(candidateSkills.map(([normalized]) => normalized));
  const matchingSkills = vacancyStack
    .filter(([normalized]) => skillSet.has(normalized))
    .map(([, display]) => display);
  const stackPoints = candidateSkills.length > 0 && vacancyStack.length > 0
    ? (50 * matchingSkills.length) / candidateSkills.length
    : 0;

  const preferences = profile?.preferences && typeof profile.preferences === "object" && !Array.isArray(profile.preferences)
    ? profile.preferences
    : {};
  const candidateWorkModel = normalizeCriterion(preferences.work_model);
  const jobWorkModel = normalizeCriterion(job?.workModelCode ?? job?.work_model);
  const workModelPoints = WORK_MODEL_POINTS[candidateWorkModel]?.[jobWorkModel] ?? 0;
  const candidateLevel = preferences.experience_level;
  const jobLevel = job?.levelCode ?? job?.level;
  const seniorityPoints = getSeniorityPoints(candidateLevel, jobLevel);
  const matchReasons = buildMatchReasons({
    matchingSkills,
    stackPoints,
    candidateWorkModel,
    jobWorkModel,
    workModelPoints,
    candidateLevel,
    jobLevel,
    seniorityPoints,
  });

  return { score: stackPoints + workModelPoints + seniorityPoints, matchReasons };
}

/** Ranking estável do conjunto passado, que deve conter somente vagas já filtradas pelo catálogo. */
export function rankJobsByCompatibility(jobs, profile) {
  return (Array.isArray(jobs) ? jobs : [])
    .map((job) => ({ ...job, ...scoreJobMatch(job, profile) }))
    .sort((left, right) => {
      const scoreDifference = right.score - left.score;
      if (scoreDifference) return scoreDifference;
      const dateDifference = dateValue(right.postedAt) - dateValue(left.postedAt);
      if (dateDifference) return dateDifference;
      return compareIds(left.id, right.id);
    });
}
