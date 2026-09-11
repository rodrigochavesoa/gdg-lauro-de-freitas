/**
 * Assignee, tags e datas nas tasks ClickUp (sync idempotente).
 * Dados de squad (e-mail, nome) vêm de docs-local/ — nunca do Git.
 */

export const TASK_TAG_TAXONOMY = [
  "Frontend",
  "Backend",
  "QA",
  "Arquitetura",
  "Banco de dados",
  "Segurança",
  "DevOps",
  "Governança",
  "UX",
  "Integração",
  "Ops humano",
];

const TAG_COLORS = {
  Frontend: { tag_fg: "#ffffff", tag_bg: "#3e63dd" },
  Backend: { tag_fg: "#ffffff", tag_bg: "#0d9488" },
  QA: { tag_fg: "#1f2937", tag_bg: "#f8ae00" },
  Arquitetura: { tag_fg: "#ffffff", tag_bg: "#8347b9" },
  "Banco de dados": { tag_fg: "#ffffff", tag_bg: "#1d4ed8" },
  Segurança: { tag_fg: "#ffffff", tag_bg: "#b42318" },
  DevOps: { tag_fg: "#ffffff", tag_bg: "#334155" },
  Governança: { tag_fg: "#ffffff", tag_bg: "#57534e" },
  UX: { tag_fg: "#1f2937", tag_bg: "#f9a8d4" },
  Integração: { tag_fg: "#ffffff", tag_bg: "#0369a1" },
  "Ops humano": { tag_fg: "#ffffff", tag_bg: "#e5484d" },
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDefaults(raw) {
  const block = raw?.defaults && typeof raw.defaults === "object" ? raw.defaults : {};
  const assignee = block.assignee && typeof block.assignee === "object" ? block.assignee : {};
  const name = assignee.name || block.assigneeName;
  return {
    assignee: {
      email: assignee.email ? String(assignee.email).trim() : null,
      userId: assignee.userId || assignee.id ? String(assignee.userId || assignee.id).trim() : null,
      name: name ? String(name).trim() : null,
    },
  };
}

export function parseTaskMetadata(raw = {}) {
  const assigneeRaw = raw.assignee;
  let assignee = { email: null, userId: null, name: null };
  if (typeof assigneeRaw === "string" && assigneeRaw.trim()) {
    const value = assigneeRaw.trim();
    assignee = value.includes("@")
      ? { email: value, userId: null, name: null }
      : { email: null, userId: /^\d+$/.test(value) ? value : null, name: /^\d+$/.test(value) ? null : value };
  } else if (assigneeRaw && typeof assigneeRaw === "object") {
    assignee = {
      email: assigneeRaw.email ? String(assigneeRaw.email).trim() : null,
      userId: assigneeRaw.userId || assigneeRaw.id ? String(assigneeRaw.userId || assigneeRaw.id).trim() : null,
      name: assigneeRaw.name ? String(assigneeRaw.name).trim() : null,
    };
  }
  return {
    assignee,
    tags: normalizeTags(raw.tags),
    openedAt: raw.openedAt ?? raw.start_date ?? null,
    closedAt: raw.closedAt ?? raw.date_closed ?? null,
  };
}

export function normalizeTags(tags, { max = 3 } = {}) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of tags) {
    const name = String(raw ?? "").trim();
    if (!name || !TASK_TAG_TAXONOMY.includes(name) || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= max) break;
  }
  return out;
}

export function parseIsoToEpochMs(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const str = String(value).trim();
  if (/^\d+$/.test(str)) {
    const n = Number(str);
    return Number.isFinite(n) ? n : null;
  }
  const isoDay = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDay) {
    return Date.UTC(Number(isoDay[1]), Number(isoDay[2]) - 1, Number(isoDay[3]), 12, 0, 0);
  }
  const parsed = Date.parse(str);
  return Number.isNaN(parsed) ? null : parsed;
}

export function formatDay(ms) {
  if (ms == null) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

export function coerceOpenClose(openedAt, closedAt, { isDone } = {}) {
  let open = parseIsoToEpochMs(openedAt);
  let close = parseIsoToEpochMs(closedAt);
  if (isDone && open != null && close == null) close = open + DAY_MS;
  if (isDone && open == null && close != null) open = close - DAY_MS;
  if (isDone && open != null && close != null && close <= open) close = open + DAY_MS;
  return { open, close };
}

export function isDoneLike(status, listStatuses) {
  const wanted = String(status ?? "").trim().toLowerCase();
  if (!wanted) return false;
  if (wanted === "done" || wanted === "complete") return true;
  const match = (listStatuses ?? []).find(
    (item) => String(item.status ?? "").toLowerCase() === wanted,
  );
  return String(match?.type ?? "").toLowerCase() === "closed";
}

export function isInProgressLike(status) {
  return String(status ?? "").trim().toLowerCase() === "in progress";
}

export function resolveAssigneeSpec({ taskMeta, defaults, env = {} }) {
  const fromTask = taskMeta?.assignee ?? {};
  const fromDefaults = defaults?.assignee ?? {};
  return {
    email: fromTask.email || fromDefaults.email || env.CLICKUP_ASSIGNEE_EMAIL || null,
    userId: fromTask.userId || fromDefaults.userId || env.CLICKUP_ASSIGNEE_USER_ID || null,
    name: fromTask.name || fromDefaults.name || env.CLICKUP_ASSIGNEE_NAME || null,
  };
}

export function findMember(members, spec) {
  if (!spec) return null;
  const users = (Array.isArray(members) ? members : []).map((item) => item.user ?? item).filter(Boolean);
  if (spec.userId) {
    const hit = users.find((user) => String(user.id) === String(spec.userId));
    if (hit) return hit;
  }
  if (spec.email) {
    const email = spec.email.toLowerCase();
    const hit = users.find((user) => String(user.email ?? "").toLowerCase() === email);
    if (hit) return hit;
  }
  if (spec.name) {
    const name = spec.name.trim().toLowerCase();
    const exact = users.find((user) => String(user.username ?? "").trim().toLowerCase() === name);
    if (exact) return exact;
    const loose = users.find((user) => {
      const username = String(user.username ?? "").trim().toLowerCase();
      if (username.length < 3) return false;
      return username.includes(name) || (name.length >= 3 && name.includes(username));
    });
    if (loose) return loose;
  }
  return null;
}

export async function loadWorkspaceMembers(client, teamId) {
  const direct = await client.get(`/team/${teamId}`);
  if (Array.isArray(direct?.members) && direct.members.length) return direct.members;
  if (Array.isArray(direct?.team?.members) && direct.team.members.length) return direct.team.members;
  const all = await client.get("/team");
  const teams = all?.teams ?? [];
  const team = teams.find((item) => String(item.id) === String(teamId)) ?? teams[0];
  return team?.members ?? [];
}

function taskHasAssignee(task, userId) {
  return (task?.assignees ?? []).some((item) => String(item.id ?? item) === String(userId));
}

function taskTagNames(task) {
  return (task?.tags ?? []).map((tag) => String(tag.name ?? tag).trim()).filter(Boolean);
}

export function appendIntervalToDescription(description, openMs, closeMs) {
  const start = formatDay(openMs);
  const end = formatDay(closeMs);
  if (!start || !end) return description ?? "";
  const line = `**Intervalo:** ${start} → ${end}`;
  const current = description ?? "";
  if (current.includes(line)) return current;
  if (/\*\*Intervalo:\*\*/.test(current)) {
    return current.replace(/\*\*Intervalo:\*\*[^\n]*/u, line);
  }
  return current ? `${current.trim()}\n\n${line}` : line;
}

export async function ensureSpaceTags(client, spaceId, tagNames, tagMap, log = () => {}) {
  const known = tagMap instanceof Map ? tagMap : new Map();
  const created = [];
  const skipped = [];
  for (const name of tagNames) {
    const key = name.toLowerCase();
    if (known.has(key)) {
      skipped.push(name);
      continue;
    }
    const colors = TAG_COLORS[name] ?? { tag_fg: "#ffffff", tag_bg: "#87909e" };
    try {
      await client.post(`/space/${spaceId}/tag`, { tag: { name, ...colors } });
      known.set(key, { name });
      created.push(name);
      log(`created tag: ${name}`);
    } catch (error) {
      known.set(key, { name });
      skipped.push(name);
      log(`tag "${name}" já existe ou não pôde ser criada (${error.message})`);
    }
  }
  return { known, created, skipped };
}

function taskCustomValue(task, fieldId) {
  return (task?.custom_fields ?? []).find((item) => String(item.id) === String(fieldId))?.value ?? null;
}

async function setDateCustomField(client, task, listFields, fieldName, epochMs, log, taskName) {
  if (epochMs == null) return false;
  const field = (listFields ?? []).find((item) => String(item.name ?? "").trim() === fieldName);
  if (!field?.id) return false;
  const current = parseIsoToEpochMs(taskCustomValue(task, field.id));
  if (current != null && formatDay(current) === formatDay(epochMs)) return false;
  await client.post(`/task/${task.id}/field/${field.id}`, { value: epochMs });
  task.custom_fields = [...(task.custom_fields ?? []).filter((item) => String(item.id) !== String(field.id)), {
    id: field.id,
    name: fieldName,
    value: epochMs,
  }];
  log(`campo "${fieldName}" em "${taskName}"`);
  return true;
}

export async function applyTaskMetadata({
  client,
  spaceId,
  task,
  taskCfg,
  defaults,
  env = {},
  members,
  spaceTagMap,
  listFields = [],
  listStatuses = [],
  isNew = false,
  log = () => {},
}) {
  const result = { assignees: "skipped", tags: "skipped", dates: "skipped" };
  if (!task?.id) return result;

  const spec = resolveAssigneeSpec({ taskMeta: taskCfg, defaults, env });
  const member = findMember(members, spec);
  if (member?.id) {
    if (taskHasAssignee(task, member.id)) {
      result.assignees = "skipped";
    } else {
      await client.put(`/task/${task.id}`, { assignees: { add: [Number(member.id)], rem: [] } });
      task.assignees = [...(task.assignees ?? []), { id: member.id, username: member.username }];
      result.assignees = "created";
      log(`assignee ${member.username ?? member.id} em "${taskCfg.name}"`);
    }
  } else if (spec.email || spec.userId || spec.name) {
    const names = (Array.isArray(members) ? members : [])
      .map((item) => item.user ?? item)
      .map((user) => user?.username)
      .filter(Boolean);
    log(
      `assignee não resolvido para "${taskCfg.name}" (confira CLICKUP_ASSIGNEE_* ou defaults). usernames: ${names.join(", ") || "(nenhum)"}`,
    );
  }

  const desiredTags = normalizeTags(taskCfg.tags);
  if (desiredTags.length && spaceId) {
    await ensureSpaceTags(client, spaceId, desiredTags, spaceTagMap, log);
    const present = new Set(taskTagNames(task).map((name) => name.toLowerCase()));
    let added = 0;
    for (const name of desiredTags) {
      if (present.has(name.toLowerCase())) continue;
      try {
        await client.post(`/task/${task.id}/tag/${encodeURIComponent(name)}`);
        present.add(name.toLowerCase());
        task.tags = [...(task.tags ?? []), { name }];
        added += 1;
        log(`tag "${name}" em "${taskCfg.name}"`);
      } catch (error) {
        log(`tag "${name}" skip em "${taskCfg.name}": ${error.message}`);
      }
    }
    result.tags = added > 0 ? "created" : "skipped";
  }

  const done = isDoneLike(taskCfg.status, listStatuses);
  const inProgress = isInProgressLike(taskCfg.status);
  let { open, close } = coerceOpenClose(taskCfg.openedAt, taskCfg.closedAt, { isDone: done });
  const existingStart = parseIsoToEpochMs(task.start_date);
  const existingClosed = parseIsoToEpochMs(task.date_closed);

  if (open == null && existingStart == null) {
    if (isNew || inProgress) open = Date.now();
    else if (done) open = Date.now() - DAY_MS;
  }
  if (done && close == null && existingClosed == null) {
    close = Date.now();
    if (open != null && close <= open) close = open + DAY_MS;
  }

  const dateBody = {};
  if (open != null && (existingStart == null || formatDay(existingStart) !== formatDay(open))) {
    dateBody.start_date = open;
    dateBody.start_date_time = false;
  }
  if (Object.keys(dateBody).length) {
    await client.put(`/task/${task.id}`, dateBody);
    Object.assign(task, dateBody);
    result.dates = "created";
    log(`start_date em "${taskCfg.name}"`);
  }

  const openedField = await setDateCustomField(
    client,
    task,
    listFields,
    "Aberta em",
    open ?? existingStart,
    log,
    taskCfg.name,
  );
  const closedField =
    done &&
    (await setDateCustomField(
      client,
      task,
      listFields,
      "Fechada em",
      close ?? existingClosed,
      log,
      taskCfg.name,
    ));
  if (openedField || closedField) result.dates = "created";

  if (done && (open ?? existingStart) && (close ?? existingClosed)) {
    const nextDescription = appendIntervalToDescription(
      taskCfg.description || "",
      open ?? existingStart,
      close ?? existingClosed,
    );
    if (nextDescription && nextDescription !== (taskCfg.description || "")) {
      taskCfg.description = nextDescription;
    }
    if (taskCfg.description?.includes("**Intervalo:**")) {
      await client.put(`/task/${task.id}`, {
        markdown_content: taskCfg.description,
        description: taskCfg.description,
      });
      task.description = taskCfg.description;
    }
  }

  return result;
}

export function tallyMetadata(created, skipped, meta) {
  for (const key of ["assignees", "tags", "dates"]) {
    if (meta?.[key] === "created") created[key] += 1;
    else skipped[key] += 1;
  }
}

export function collectConfigTags(tasks) {
  const set = new Set();
  for (const task of tasks ?? []) {
    for (const tag of normalizeTags(task.tags)) set.add(tag);
  }
  return [...set];
}
