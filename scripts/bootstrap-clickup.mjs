/**
 * Provisiona (ou completa) um Space ClickUp a partir de docs-local/clickup/bootstrap.config.json.
 * Idempotente: cria só o que falta; não duplica Space/Folder/List/task (match por nome).
 * Credenciais: docs-local/clickup.env (fallback .env.local, só CLICKUP_*).
 * Uso: pnpm clickup:bootstrap
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";
export const CLICKUP_API_V3_BASE = "https://api.clickup.com/api/v3";
export const NEXT_STEP_MANUAL =
  "próximo passo manual: GitHub integration (OAuth na UI ClickUp — setup.md §3)";
export const DEFAULT_CONFIG_PATH = "docs-local/clickup/bootstrap.config.json";
export const DEFAULT_CONFIG_EXAMPLE_PATH = "docs-local.example/clickup/bootstrap.config.example.json";
export const DEFAULT_ENV_PATH = "docs-local/clickup.env";
export const FALLBACK_ENV_PATH = ".env.local";

const SPACE_FEATURES = {
  due_dates: {
    enabled: true,
    start_date: false,
    remap_due_dates: true,
    remap_closed_due_date: false,
  },
  time_tracking: { enabled: false },
  tags: { enabled: true },
  time_estimates: { enabled: false },
  checklists: { enabled: true },
  custom_fields: { enabled: true },
  remap_dependencies: { enabled: true },
  dependency_warning: { enabled: true },
  portfolios: { enabled: false },
};

export function parseEnvFile(text) {
  const env = {};
  if (!text) return env;
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

export function pickClickUpEnv(source) {
  const out = {};
  if (!source || typeof source !== "object") return out;
  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith("CLICKUP_") && value != null && String(value).trim() !== "") {
      out[key] = String(value).trim();
    }
  }
  return out;
}

export function missingCredentialsMessage() {
  return [
    "Faltam CLICKUP_API_TOKEN e/ou CLICKUP_TEAM_ID.",
    "Copie docs-local.example/clickup.env.example para docs-local/clickup.env",
    "e preencha o token (Settings → Apps → API) e o team id (URL do workspace).",
    "Não commite docs-local/ — a pasta está no .gitignore.",
  ].join(" ");
}

export function missingClickUpConfigMessage(configPath, examplePath) {
  return [
    `Arquivo de config não encontrado: ${configPath}`,
    `Copie ${examplePath} para ${configPath} e ajuste ao seu squad (sprints, tasks, handoff).`,
    "Configs operacionais ficam em docs-local/clickup/ — não vão para o GitHub.",
  ].join(" ");
}

export function hasCredentials(env) {
  return Boolean(env?.CLICKUP_API_TOKEN && env?.CLICKUP_TEAM_ID);
}

export function loadClickUpEnvFromFiles({
  cwd = process.cwd(),
  exists = existsSync,
  readFile = readFileSync,
} = {}) {
  const clickupPath = resolve(cwd, DEFAULT_ENV_PATH);
  const fallbackPath = resolve(cwd, FALLBACK_ENV_PATH);
  let fromFiles = {};
  if (exists(clickupPath)) {
    fromFiles = parseEnvFile(readFile(clickupPath, "utf8"));
  } else if (exists(fallbackPath)) {
    fromFiles = pickClickUpEnv(parseEnvFile(readFile(fallbackPath, "utf8")));
  }
  return pickClickUpEnv(fromFiles);
}

export function findByName(items, name) {
  if (!Array.isArray(items) || name == null) return null;
  const needle = String(name).trim();
  return items.find((item) => item && String(item.name ?? "").trim() === needle) ?? null;
}

export function parseBootstrapConfig(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("bootstrap.config.json inválido: esperado objeto.");
  }
  const spaceName = raw.space?.name?.trim();
  if (!spaceName) {
    throw new Error("bootstrap.config.json inválido: space.name é obrigatório.");
  }
  if (!Array.isArray(raw.folders) || raw.folders.length === 0) {
    throw new Error("bootstrap.config.json inválido: folders[] é obrigatório.");
  }
  const folders = raw.folders.map((folder, index) => {
    const name = folder?.name?.trim();
    if (!name) {
      throw new Error(`bootstrap.config.json inválido: folders[${index}].name é obrigatório.`);
    }
    const lists = Array.isArray(folder.lists)
      ? folder.lists.map((list, listIndex) => {
          const listName = list?.name?.trim();
          if (!listName) {
            throw new Error(
              `bootstrap.config.json inválido: folders[${index}].lists[${listIndex}].name é obrigatório.`,
            );
          }
          return { name: listName };
        })
      : [];
    return { name, lists };
  });
  if (!Array.isArray(raw.customFields) || raw.customFields.length === 0) {
    throw new Error("bootstrap.config.json inválido: customFields[] é obrigatório.");
  }
  const customFields = raw.customFields.map((field, index) => {
    const name = field?.name?.trim();
    const type = field?.type?.trim();
    if (!name || !type) {
      throw new Error(
        `bootstrap.config.json inválido: customFields[${index}] precisa de name e type.`,
      );
    }
    return {
      name,
      type,
      options: Array.isArray(field.options) ? field.options.map(String) : [],
    };
  });
  if (!Array.isArray(raw.tasks)) {
    throw new Error("bootstrap.config.json inválido: tasks[] é obrigatório.");
  }
  const tasks = raw.tasks.map((task, index) => {
    const name = task?.name?.trim();
    const list = task?.list?.trim();
    if (!name || !list) {
      throw new Error(
        `bootstrap.config.json inválido: tasks[${index}] precisa de name e list.`,
      );
    }
    return {
      name,
      list,
      status: task.status ? String(task.status).trim() : "Backlog",
      fields: task.fields && typeof task.fields === "object" ? { ...task.fields } : {},
      description: task.description ? String(task.description) : "",
      comment: task.comment ? String(task.comment) : "",
    };
  });
  const listStatuses = Array.isArray(raw.listStatuses)
    ? raw.listStatuses.map((status, index) => {
        const label = status?.status?.trim();
        if (!label) {
          throw new Error(
            `bootstrap.config.json inválido: listStatuses[${index}].status é obrigatório.`,
          );
        }
        return {
          status: label,
          type: status.type ? String(status.type) : "custom",
          color: status.color ? String(status.color) : "#87909e",
        };
      })
    : [];
  return {
    space: {
      name: spaceName,
      multiple_assignees: raw.space.multiple_assignees !== false,
    },
    folders,
    customFields,
    tasks,
    listStatuses,
  };
}

export function resolveTaskStatus(desired, listStatuses) {
  const wanted = String(desired ?? "").trim();
  const statuses = Array.isArray(listStatuses) ? listStatuses : [];
  if (!wanted || statuses.length === 0) return null;
  const exact = statuses.find(
    (item) => String(item.status ?? "").trim().toLowerCase() === wanted.toLowerCase(),
  );
  if (exact) return String(exact.status);
  const closed = statuses.find((item) => String(item.type ?? "").toLowerCase() === "closed");
  const open = statuses.find((item) => String(item.type ?? "").toLowerCase() === "open");
  if (wanted.toLowerCase() === "done") return closed?.status ?? null;
  if (wanted.toLowerCase() === "blocked") return open?.status ?? statuses[0]?.status ?? null;
  return open?.status ?? statuses[0]?.status ?? null;
}

export function resolveDropdownValue(field, optionName) {
  if (!field || optionName == null) return null;
  const needle = String(optionName).trim();
  const options = field.type_config?.options ?? field.typeConfig?.options ?? [];
  const match = options.find((option) => String(option.name ?? option.label ?? "").trim() === needle);
  if (!match) return null;
  return match.id ?? match.orderindex ?? null;
}

export function customFieldPayload(field) {
  const payload = { name: field.name, type: field.type };
  if (field.type === "drop_down") {
    payload.type_config = {
      sorting: "manual",
      options: (field.options ?? []).map((name, orderindex) => ({
        name,
        orderindex,
        color: "#87909e",
      })),
    };
  }
  return payload;
}

export function emptyCounters() {
  return { spaces: 0, folders: 0, lists: 0, fields: 0, tasks: 0 };
}

export function buildSummary({ spaceId, listIds, taskIds, created, skipped }) {
  return {
    spaceId,
    listIds,
    taskIds,
    created,
    skipped,
    nextStep: NEXT_STEP_MANUAL,
  };
}

function redactSecrets(text) {
  return String(text).replace(/pk_[A-Za-z0-9]+/gi, "[redacted]");
}

function apiErrorMessage(method, path, status, data) {
  const detail =
    data?.err || data?.error || data?.ECODE || (typeof data === "string" ? data : JSON.stringify(data));
  return redactSecrets(`ClickUp API ${method} ${path} → ${status}: ${detail ?? "erro"}`);
}

export function createClickUpClient({ token, fetchImpl = globalThis.fetch }) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch nativo indisponível (Node 22+).");
  }
  async function request(method, path, body) {
    const url = path.startsWith("http") ? path : `${CLICKUP_API_BASE}${path}`;
    const headers = {
      Authorization: token,
      Accept: "application/json",
    };
    const init = { method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const res = await fetchImpl(url, init);
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!res.ok) {
      const error = new Error(apiErrorMessage(method, path, res.status, data));
      error.status = res.status;
      throw error;
    }
    return data;
  }
  return {
    request,
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),
  };
}

/** Move task home List (ClickUp API v3). PUT v2 /task/{id} com list_id não move. */
export async function moveTaskToHomeList(
  client,
  { workspaceId, taskId, listId, body = { move_custom_fields: true } },
) {
  const path = `${CLICKUP_API_V3_BASE}/workspaces/${workspaceId}/tasks/${taskId}/home_list/${listId}`;
  return client.request("PUT", path, body);
}

async function createList(client, folderId, name, listStatuses, log) {
  const path = `/folder/${folderId}/list`;
  try {
    const body = { name };
    if (listStatuses.length > 0) body.statuses = listStatuses;
    return await client.post(path, body);
  } catch (error) {
    if (listStatuses.length === 0) throw error;
    log(`statuses não aplicados na List "${name}" via API; criando só o nome`);
    return client.post(path, { name });
  }
}

function unwrapField(payload) {
  if (payload?.field && typeof payload.field === "object") return payload.field;
  return payload;
}

async function createCustomField(client, listId, fieldCfg, log) {
  const path = `/list/${listId}/field`;
  try {
    return unwrapField(await client.post(path, customFieldPayload(fieldCfg)));
  } catch (error) {
    if (fieldCfg.type !== "short_text") throw error;
    log(`short_text não aceito para "${fieldCfg.name}"; tentando type text`);
    return unwrapField(await client.post(path, customFieldPayload({ ...fieldCfg, type: "text" })));
  }
}

async function getAllTasks(client, listId) {
  const tasks = [];
  for (let page = 0; page < 50; page += 1) {
    const data = await client.get(`/list/${listId}/task?include_closed=true&page=${page}`);
    const batch = Array.isArray(data?.tasks) ? data.tasks : [];
    tasks.push(...batch);
    if (data?.last_page === true || batch.length < 100) break;
  }
  return tasks;
}

export async function bootstrapClickUp({ client, teamId, config, log = () => {} }) {
  const created = emptyCounters();
  const skipped = emptyCounters();
  const listIds = {};
  const taskIds = {};

  const spacesPayload = await client.get(`/team/${teamId}/space?archived=false`);
  const spaces = spacesPayload?.spaces ?? [];
  let space = findByName(spaces, config.space.name);
  if (space) {
    skipped.spaces += 1;
    log(`skipped space: ${config.space.name}`);
  } else {
    space = await client.post(`/team/${teamId}/space`, {
      name: config.space.name,
      multiple_assignees: config.space.multiple_assignees,
      features: SPACE_FEATURES,
    });
    created.spaces += 1;
    log(`created space: ${config.space.name}`);
  }
  const spaceId = String(space.id);

  const foldersPayload = await client.get(`/space/${spaceId}/folder?archived=false`);
  const folders = foldersPayload?.folders ?? [];

  for (const folderCfg of config.folders) {
    let folder = findByName(folders, folderCfg.name);
    if (folder) {
      skipped.folders += 1;
      log(`skipped folder: ${folderCfg.name}`);
    } else {
      folder = await client.post(`/space/${spaceId}/folder`, { name: folderCfg.name });
      folders.push(folder);
      created.folders += 1;
      log(`created folder: ${folderCfg.name}`);
    }

    const listsPayload = await client.get(`/folder/${folder.id}/list?archived=false`);
    const lists = listsPayload?.lists ?? [];
    for (const listCfg of folderCfg.lists) {
      let list = findByName(lists, listCfg.name);
      if (list) {
        skipped.lists += 1;
        log(`skipped list: ${listCfg.name}`);
      } else {
        list = await createList(client, folder.id, listCfg.name, config.listStatuses, log);
        lists.push(list);
        created.lists += 1;
        log(`created list: ${listCfg.name}`);
      }
      listIds[listCfg.name] = String(list.id);
    }
  }

  const fieldByList = {};
  for (const listName of Object.keys(listIds)) {
    const listId = listIds[listName];
    const fieldsPayload = await client.get(`/list/${listId}/field`);
    const fields = Array.isArray(fieldsPayload?.fields) ? fieldsPayload.fields : [];
    for (const fieldCfg of config.customFields) {
      let field = findByName(fields, fieldCfg.name);
      if (field) {
        skipped.fields += 1;
        log(`skipped field: ${fieldCfg.name} @ ${listName}`);
      } else {
        field = await createCustomField(client, listId, fieldCfg, log);
        if (field?.id) fields.push(field);
        created.fields += 1;
        log(`created field: ${fieldCfg.name} @ ${listName}`);
      }
    }
    const refreshed = await client.get(`/list/${listId}/field`);
    fieldByList[listName] = Array.isArray(refreshed?.fields) ? refreshed.fields : fields;
  }

  const tasksByList = {};
  const statusesByList = {};
  for (const listName of Object.keys(listIds)) {
    const listId = listIds[listName];
    const detail = await client.get(`/list/${listId}`);
    statusesByList[listName] = Array.isArray(detail?.statuses) ? detail.statuses : [];
    tasksByList[listName] = await getAllTasks(client, listId);
  }

  for (const taskCfg of config.tasks) {
    const listId = listIds[taskCfg.list];
    if (!listId) {
      throw new Error(`List "${taskCfg.list}" não encontrada para a task "${taskCfg.name}".`);
    }
    const existing = findByName(tasksByList[taskCfg.list] ?? [], taskCfg.name);
    let task;
    if (existing) {
      skipped.tasks += 1;
      log(`skipped task: ${taskCfg.name}`);
      task = existing;
    } else {
      const resolvedStatus = resolveTaskStatus(taskCfg.status, statusesByList[taskCfg.list]);
      if (resolvedStatus && resolvedStatus.toLowerCase() !== String(taskCfg.status).toLowerCase()) {
        log(
          `status "${taskCfg.status}" mapeado para "${resolvedStatus}" em "${taskCfg.name}" (statuses customizados só na UI ClickUp)`,
        );
      }
      const body = {
        name: taskCfg.name,
        markdown_content: taskCfg.description || undefined,
        description: taskCfg.description || undefined,
      };
      if (resolvedStatus) body.status = resolvedStatus;
      task = await client.post(`/list/${listId}/task`, body);
      (tasksByList[taskCfg.list] ??= []).push(task);
      created.tasks += 1;
      log(`created task: ${taskCfg.name}`);
      if (taskCfg.comment) {
        await client.post(`/task/${task.id}/comment`, { comment_text: taskCfg.comment });
      }
    }
    taskIds[taskCfg.name] = String(task.id);

    const listFields = fieldByList[taskCfg.list] ?? [];
    for (const [fieldName, rawValue] of Object.entries(taskCfg.fields)) {
      const field = findByName(listFields, fieldName);
      if (!field?.id) {
        log(`campo "${fieldName}" ainda sem id — não preenchido em "${taskCfg.name}"`);
        continue;
      }
      const type = String(field.type ?? "");
      let value = rawValue;
      if (type === "drop_down") {
        value = resolveDropdownValue(field, rawValue);
        if (value == null) {
          log(`opção "${rawValue}" não encontrada em "${fieldName}"`);
          continue;
        }
      }
      await client.post(`/task/${task.id}/field/${field.id}`, { value });
    }
  }

  return buildSummary({ spaceId, listIds, taskIds, created, skipped });
}

export async function main({
  cwd = process.cwd(),
  env = process.env,
  exists = existsSync,
  readFile = readFileSync,
  fetchImpl = globalThis.fetch,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  const fromFiles = loadClickUpEnvFromFiles({ cwd, exists, readFile });
  const credentials = { ...fromFiles, ...pickClickUpEnv(env) };
  if (!hasCredentials(credentials)) {
    stderr(missingCredentialsMessage());
    return 1;
  }

  const configPath = resolve(cwd, env.CLICKUP_BOOTSTRAP_CONFIG || DEFAULT_CONFIG_PATH);
  if (!exists(configPath)) {
    stderr(missingClickUpConfigMessage(configPath, DEFAULT_CONFIG_EXAMPLE_PATH));
    return 1;
  }

  let config;
  try {
    config = parseBootstrapConfig(JSON.parse(readFile(configPath, "utf8")));
  } catch (error) {
    stderr(error.message);
    return 1;
  }

  const client = createClickUpClient({
    token: credentials.CLICKUP_API_TOKEN,
    fetchImpl,
  });

  try {
    const summary = await bootstrapClickUp({
      client,
      teamId: credentials.CLICKUP_TEAM_ID,
      config,
      log: stdout,
    });
    stdout(JSON.stringify(summary, null, 2));
    stdout(NEXT_STEP_MANUAL);
    return 0;
  } catch (error) {
    stderr(redactSecrets(error.message));
    return 1;
  }
}

const invokedDirectly =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (invokedDirectly) {
  main().then((code) => {
    process.exit(code);
  });
}
