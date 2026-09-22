import { reaisInputFromCents } from "../../lib/catalog-url.js";

export const emptyJobForm = {
  title: "",
  companyId: "",
  newCompanyName: "",
  level: "",
  description: "",
  stackText: "",
  location: "",
  countryCode: "",
  salaryMinText: "",
  salaryMaxText: "",
  workModel: "Remoto",
};

const LEVEL_FROM_DB = {
  intern: "Estágio",
  junior: "Júnior",
  mid: "Pleno",
  senior: "Sênior",
};

const MODEL_FROM_DB = {
  hybrid: "Híbrido",
  onsite: "Presencial",
  remote: "Remoto",
};

export function jobToForm(job) {
  return {
    title: job.title ?? "",
    companyId: job.company_id ?? "",
    newCompanyName: "",
    level: LEVEL_FROM_DB[job.level] ?? "",
    description: job.description ?? "",
    stackText: (job.stack ?? []).join(", "),
    location: job.location ?? "",
    countryCode: job.country_code ?? "",
    salaryMinText: reaisInputFromCents(job.salary_min),
    salaryMaxText: reaisInputFromCents(job.salary_max),
    workModel: MODEL_FROM_DB[job.work_model] ?? "Remoto",
  };
}

export function adminJobStatusLabel(status) {
  if (status === "pending") return "Pendente";
  if (status === "approved") return "Publicada";
  if (status === "rejected") return "Rejeitada";
  return status ?? "";
}
