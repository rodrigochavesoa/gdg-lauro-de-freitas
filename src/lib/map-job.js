const LEVEL_LABEL = {
  intern: "Estágio",
  junior: "Júnior",
  mid: "Pleno",
  senior: "Sênior",
  lead: "Sênior",
};

const WORK_MODEL_LABEL = {
  remote: "Remoto",
  hybrid: "Híbrido",
  onsite: "Presencial",
};

const LOGO_COLORS = ["#4285f4", "#ea4335", "#fbbc04", "#34a853"];

export function mapJob(row) {
  const company = row.companies?.name ?? "Empresa";
  const stack = Array.isArray(row.stack) ? row.stack : [];
  const mandatory = Array.isArray(row.requirements?.mandatory)
    ? row.requirements.mandatory
    : [];
  const workModel = WORK_MODEL_LABEL[row.work_model] ?? row.work_model ?? "";
  const location = row.location?.trim() || "";
  const place = [location, workModel].filter(Boolean).join(" · ");

  return {
    id: row.id,
    title: row.title,
    company,
    logo: companyLogo(company),
    color: companyColor(company),
    level: LEVEL_LABEL[row.level] ?? row.level,
    place,
    type: workModel || "—",
    posted: formatPosted(row.approved_at ?? row.created_at),
    stack,
    salary: "A combinar",
    featured: false,
    description: row.description,
    about: row.companies?.description ?? "",
    responsibilities: mandatory,
    status: row.status,
  };
}

export function companyLogo(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "GD";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function companyColor(name) {
  let hash = 0;
  for (const char of String(name)) {
    hash = (hash + char.charCodeAt(0)) % LOGO_COLORS.length;
  }
  return LOGO_COLORS[hash];
}

export function formatPosted(isoDate) {
  if (!isoDate) return "há alguns dias";
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return "há alguns dias";
  const days = Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
  if (days <= 1) return "há 1 dia";
  if (days < 7) return `há ${days} dias`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "há 1 semana";
  return `há ${weeks} semanas`;
}
