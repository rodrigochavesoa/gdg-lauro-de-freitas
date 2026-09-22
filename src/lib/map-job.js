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

/** Paleta das iniciais: família GDG, fundo escurecido para texto branco ≥ 4,5:1 (WCAG 1.4.3). */
export const LOGO_COLORS = ["#1e40af", "#991b1b", "#92400e", "#166534"];
export const LOGO_FG = "#ffffff";
export const MIN_LOGO_CONTRAST_RATIO = 4.5;

export function relativeLuminance(hex) {
  const value = String(hex ?? "").replace("#", "");
  if (value.length !== 6) return 0;
  const channel = (start) => {
    const c = parseInt(value.slice(start, start + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

export function contrastRatio(foreground, background) {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function readSalaryCents(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string" && !/^\d+$/.test(value)) return null;
  const cents = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(cents) || cents < 0) return null;
  return cents;
}

function formatCents(cents, currency) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** Faixa em pt-BR, ou "A combinar" quando piso e teto estão vazios. */
export function formatJobSalary(row) {
  const min = readSalaryCents(row?.salary_min);
  const max = readSalaryCents(row?.salary_max);
  if (min == null && max == null) return "A combinar";
  const currency = /^[A-Z]{3}$/.test(String(row?.salary_currency ?? ""))
    ? row.salary_currency
    : "BRL";
  if (min != null && max != null) return `${formatCents(min, currency)} – ${formatCents(max, currency)}`;
  if (min != null) return `A partir de ${formatCents(min, currency)}`;
  return `Até ${formatCents(max, currency)}`;
}

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
    postedAt: row.approved_at ?? row.created_at ?? null,
    stack,
    salary: formatJobSalary(row),
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
