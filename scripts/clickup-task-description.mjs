/**
 * Descrição markdown de tasks ClickUp — seções fixas, sem tabelas.
 * Campos custom (História ID, PR, …) vêm do JSON + applyCustomFields no sync.
 */

function bulletBlock(lines) {
  const items = (Array.isArray(lines) ? lines : [lines])
    .map((line) => String(line ?? "").trim())
    .filter(Boolean);
  if (!items.length) return "—\n";
  return `${items.map((line) => `- ${line}`).join("\n")}\n`;
}

function checklistBlock(items) {
  const rows = (Array.isArray(items) ? items : [])
    .map((line) => String(line ?? "").trim())
    .filter(Boolean);
  if (!rows.length) return "—\n";
  return `${rows.map((line) => (line.startsWith("- [") ? line : `- [ ] ${line}`)).join("\n")}\n`;
}

/**
 * @param {object} sections
 * @param {{ deliveryStatus?: string, delivery?: object }} [opts]
 */
export function renderTaskDescription(sections, opts = {}) {
  const s = sections && typeof sections === "object" ? sections : {};
  const deliveryStatus = opts.deliveryStatus ?? s.deliveryStatus ?? "planejamento";
  const d = opts.delivery ?? s.delivery ?? {};

  const parts = [
    "## Problema / contexto\n",
    `${String(s.problem ?? "—").trim()}\n`,
    "## Objetivo\n",
    `${String(s.objective ?? "—").trim()}\n`,
    "## Escopo\n",
    bulletBlock(s.scope),
    "## Fora do escopo\n",
    bulletBlock(s.outOfScope),
    "## Definição de pronto (DoD / aceite)\n",
    checklistBlock(s.dod),
    "## Dependências e bloqueios\n",
    bulletBlock(s.dependencies),
    "## Referências\n",
    bulletBlock(s.references),
    "## Entrega (preencher ao concluir)\n",
    `**Status entrega:** ${deliveryStatus}\n`,
    `**PR:** ${d.pr ?? "—"}\n`,
    `**SHA merge em main:** ${d.sha ?? "—"}\n`,
    `**Preview / evidência:** ${d.evidence ?? "—"}\n`,
    "### O que foi resolvido\n",
    `${String(d.resolved ?? "_A preencher ao marcar Done._").trim()}\n`,
    "### O que foi alterado (resumo técnico)\n",
    `${String(d.changed ?? "_A preencher ao marcar Done._").trim()}\n`,
  ];
  if (s.governance) {
    parts.push("## Governança\n", `${String(s.governance).trim()}\n`);
  }
  return parts.join("\n").trim();
}

const STORY_ID_RE = /\b([A-Z]{2,}(?:-[A-Z0-9]+)+-\d{2})\b/;

export function storyIdFromTaskName(name) {
  const match = String(name ?? "").match(STORY_ID_RE);
  return match?.[1] ?? null;
}

/** Mescla storyId/priority/pr/veredito nos custom fields; gera description a partir de sections. */
export function enrichHandoffTask(task) {
  if (!task || typeof task !== "object") return task;
  const out = { ...task };
  const storyId = out.storyId || out.fields?.["História ID"] || storyIdFromTaskName(out.name);
  const fields = { ...(out.fields ?? {}) };
  if (storyId) fields["História ID"] = storyId;
  if (out.priority) fields.Prioridade = out.priority;
  if (out.pr != null) fields.PR = out.pr;
  if (out.vereditoPlan != null) fields["Veredito Plan"] = out.vereditoPlan;
  out.fields = fields;

  if (out.sections && typeof out.sections === "object") {
    out.description = renderTaskDescription(out.sections, {
      deliveryStatus: out.deliveryStatus,
      delivery: out.delivery,
    });
  }
  return out;
}
