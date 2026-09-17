export const CATALOG_TECHNOLOGIES = ["React", "Node.js", "TypeScript", "Python", "UX/UI", "Dados"];
export const CATALOG_LEVELS = ["Estágio", "Júnior", "Pleno", "Sênior"];
export const CATALOG_WORK_MODELS = ["Remoto", "Híbrido", "Presencial"];

/** Tags extras do seed / catálogo para busca de stack na query (sem coluna nova). */
export const CATALOG_SEARCH_STACK_TERMS = [
  ...CATALOG_TECHNOLOGIES,
  "Next.js",
  "PostgreSQL",
  "AWS",
  "Figma",
  "UX Research",
  "Design System",
  "SQL",
  "Databricks",
];

const LEVEL_LABEL_TO_DB = {
  Estágio: ["intern"],
  Júnior: ["junior"],
  Pleno: ["mid"],
  Sênior: ["senior", "lead"],
  intern: ["intern"],
  junior: ["junior"],
  mid: ["mid"],
  senior: ["senior", "lead"],
  lead: ["lead"],
};

const WORK_MODEL_LABEL_TO_DB = {
  Remoto: "remote",
  Híbrido: "hybrid",
  Presencial: "onsite",
  remote: "remote",
  hybrid: "hybrid",
  onsite: "onsite",
};

export function mapLevelFiltersToDb(levelLabels = []) {
  const enums = [];
  for (const label of levelLabels) {
    const mapped = LEVEL_LABEL_TO_DB[label];
    if (mapped) enums.push(...mapped);
  }
  return [...new Set(enums)];
}

export function mapWorkModelFiltersToDb(workModels = []) {
  const enums = [];
  for (const label of workModels) {
    const mapped = WORK_MODEL_LABEL_TO_DB[label];
    if (mapped) enums.push(mapped);
  }
  return [...new Set(enums)];
}

export function stackTermsForSearch(query, dictionary = CATALOG_SEARCH_STACK_TERMS) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matched = dictionary.filter(
    (term) => term.toLowerCase().includes(q) || q.includes(term.toLowerCase()),
  );
  const exact = query.trim();
  if (exact && !matched.some((term) => term.toLowerCase() === exact.toLowerCase())) {
    matched.push(exact);
  }
  return matched;
}

export function filterJobs(jobs, { query = "", tech = [], level = [], workModel = [] } = {}) {
  const normalizedQuery = query.toLowerCase();

  return jobs.filter((job) => {
    const searched = `${job.title} ${job.company} ${job.stack.join(" ")}`
      .toLowerCase()
      .includes(normalizedQuery);
    const hasTech =
      tech.length === 0 ||
      tech.some((item) => job.stack.join(" ").toLowerCase().includes(item.toLowerCase()));
    const hasLevel = level.length === 0 || level.includes(job.level);
    const hasWorkModel = workModel.length === 0 || workModel.includes(job.type);

    return searched && hasTech && hasLevel && hasWorkModel;
  });
}

export function toggleFilterValue(item, values) {
  return values.includes(item) ? values.filter((value) => value !== item) : [...values, item];
}

/** id estável para checkbox de filtro (único na view, ASCII). */
export function formOptionId(group, value) {
  const slug = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${group}-${slug}`;
}

export const SORT_RECENT = "recent";
export const SORT_OLDEST = "oldest";

function postedTime(job) {
  const parsed = Date.parse(job?.postedAt ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function sortJobs(jobs, order = SORT_RECENT) {
  const ranked = [...jobs];
  ranked.sort((left, right) => {
    const delta = postedTime(right) - postedTime(left);
    return order === SORT_OLDEST ? -delta : delta;
  });
  return ranked;
}
