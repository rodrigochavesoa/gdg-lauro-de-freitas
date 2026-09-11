/**
 * Aplica handoff de sprint a partir de docs-local/clickup/sprint-handoff.config.json
 * (Sprint Notes, move de tasks entre lists, novas tasks).
 * Idempotente: reexecutar atualiza status/campos sem duplicar.
 * Uso: pnpm clickup:sprint-handoff
 * Sync completo: pnpm clickup:sync
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createClickUpClient,
  findByName,
  hasCredentials,
  loadClickUpEnvFromFiles,
  missingCredentialsMessage,
  moveTaskToHomeList,
  missingClickUpConfigMessage,
  parseBootstrapConfig,
  pickClickUpEnv,
  resolveDropdownValue,
  resolveTaskStatus,
} from "./bootstrap-clickup.mjs";

export const DEFAULT_HANDOFF_CONFIG_PATH = "docs-local/clickup/sprint-handoff.config.json";
export const DEFAULT_HANDOFF_CONFIG_EXAMPLE_PATH =
  "docs-local.example/clickup/sprint-handoff.config.example.json";
export const DEFAULT_BOOTSTRAP_CONFIG_PATH = "docs-local/clickup/bootstrap.config.json";

export function parseHandoffConfig(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("sprint-handoff.config.json inválido: esperado objeto.");
  }
  const spaceName = raw.spaceName?.trim();
  if (!spaceName) {
    throw new Error("sprint-handoff.config.json inválido: spaceName é obrigatório.");
  }

  const parseTaskLike = (task, index, label) => {
    const name = task?.name?.trim() || task?.taskName?.trim();
    const list = task?.list?.trim();
    if (!name) {
      throw new Error(`sprint-handoff.config.json inválido: ${label}[${index}].name é obrigatório.`);
    }
    if (label !== "sprintNotes" && !list) {
      throw new Error(`sprint-handoff.config.json inválido: ${label}[${index}].list é obrigatório.`);
    }
    return {
      name,
      list: list ?? "",
      taskName: task?.taskName?.trim() || name,
      status: task.status ? String(task.status).trim() : "Backlog",
      fields: task.fields && typeof task.fields === "object" ? { ...task.fields } : {},
      description: task.description ? String(task.description) : "",
      comment: task.comment ? String(task.comment) : "",
    };
  };

  const sprintNotes = Array.isArray(raw.sprintNotes)
    ? raw.sprintNotes.map((item, index) => parseTaskLike(item, index, "sprintNotes"))
    : [];

  const moveTasks = Array.isArray(raw.moveTasks)
    ? raw.moveTasks.map((item, index) => {
        const name = item?.name?.trim();
        const fromList = item?.fromList?.trim();
        const toList = item?.toList?.trim();
        if (!name || !fromList || !toList) {
          throw new Error(
            `sprint-handoff.config.json inválido: moveTasks[${index}] precisa name, fromList, toList.`,
          );
        }
        return {
          name,
          fromList,
          toList,
          status: item.status ? String(item.status).trim() : undefined,
        };
      })
    : [];

  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks.map((item, index) => parseTaskLike(item, index, "tasks"))
    : [];

  return { spaceName, sprintNotes, moveTasks, tasks };
}

export function emptyHandoffCounters() {
  return { notes: 0, moved: 0, tasks: 0, updated: 0 };
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

export async function resolveSpaceLists(client, teamId, spaceName, log = () => {}) {
  const spacesPayload = await client.get(`/team/${teamId}/space?archived=false`);
  const space = findByName(spacesPayload?.spaces ?? [], spaceName);
  if (!space) {
    throw new Error(
      `Space "${spaceName}" não encontrado. Rode pnpm clickup:bootstrap antes do handoff.`,
    );
  }

  const listIds = {};
  const statusesByList = {};
  const tasksByList = {};
  const fieldByList = {};

  const foldersPayload = await client.get(`/space/${space.id}/folder?archived=false`);
  const folders = foldersPayload?.folders ?? [];

  for (const folder of folders) {
    const listsPayload = await client.get(`/folder/${folder.id}/list?archived=false`);
    for (const list of listsPayload?.lists ?? []) {
      const listName = String(list.name ?? "").trim();
      listIds[listName] = String(list.id);
      const detail = await client.get(`/list/${list.id}`);
      statusesByList[listName] = Array.isArray(detail?.statuses) ? detail.statuses : [];
      tasksByList[listName] = await getAllTasks(client, list.id);
      const fieldsPayload = await client.get(`/list/${list.id}/field`);
      fieldByList[listName] = Array.isArray(fieldsPayload?.fields) ? fieldsPayload.fields : [];
      log(`resolved list: ${listName} (${list.id})`);
    }
  }

  return {
    spaceId: String(space.id),
    listIds,
    statusesByList,
    tasksByList,
    fieldByList,
  };
}

async function applyCustomFields(client, taskId, listFields, fields, log, taskName) {
  for (const [fieldName, rawValue] of Object.entries(fields ?? {})) {
    const field = findByName(listFields, fieldName);
    if (!field?.id) {
      log(`campo "${fieldName}" ausente em "${taskName}"`);
      continue;
    }
    const type = String(field.type ?? "");
    let value = rawValue;
    if (type === "drop_down") {
      value = resolveDropdownValue(field, rawValue);
      if (value == null) {
        log(`opção "${rawValue}" não encontrada em "${fieldName}" (${taskName})`);
        continue;
      }
    }
    await client.post(`/task/${taskId}/field/${field.id}`, { value });
  }
}

async function upsertTask({
  client,
  taskCfg,
  listName,
  listId,
  listFields,
  listStatuses,
  existingTasks,
  log,
  counters,
  taskIds,
}) {
  const name = taskCfg.taskName || taskCfg.name;
  let task = findByName(existingTasks, name);
  const resolvedStatus = resolveTaskStatus(taskCfg.status, listStatuses);

  if (task) {
    const body = {};
    if (resolvedStatus && String(task.status ?? "").toLowerCase() !== resolvedStatus.toLowerCase()) {
      body.status = resolvedStatus;
    }
    if (taskCfg.description) {
      body.markdown_content = taskCfg.description;
      body.description = taskCfg.description;
    }
    if (Object.keys(body).length > 0) {
      await client.put(`/task/${task.id}`, body);
      counters.updated += 1;
      log(`updated task: ${name}`);
    } else {
      log(`skipped task (sem mudança): ${name}`);
    }
  } else {
    const body = {
      name,
      markdown_content: taskCfg.description || undefined,
      description: taskCfg.description || undefined,
    };
    if (resolvedStatus) body.status = resolvedStatus;
    task = await client.post(`/list/${listId}/task`, body);
    existingTasks.push(task);
    counters.tasks += 1;
    log(`created task: ${name}`);
    if (taskCfg.comment) {
      await client.post(`/task/${task.id}/comment`, { comment_text: taskCfg.comment });
    }
  }

  taskIds[name] = String(task.id);
  await applyCustomFields(client, task.id, listFields, taskCfg.fields, log, name);
}

export async function sprintHandoffClickUp({ client, teamId, handoff, log = () => {} }) {
  const created = emptyHandoffCounters();
  const skipped = emptyHandoffCounters();
  const taskIds = {};

  const workspace = await resolveSpaceLists(client, teamId, handoff.spaceName, log);
  const { listIds, statusesByList, tasksByList, fieldByList } = workspace;

  for (const note of handoff.sprintNotes) {
    const listId = listIds[note.list];
    if (!listId) {
      throw new Error(`List "${note.list}" não encontrada para Sprint Note.`);
    }
    const tasksBefore = created.tasks;
    await upsertTask({
      client,
      taskCfg: note,
      listName: note.list,
      listId,
      listFields: fieldByList[note.list] ?? [],
      listStatuses: statusesByList[note.list] ?? [],
      existingTasks: tasksByList[note.list] ?? [],
      log,
      counters: created,
      taskIds,
    });
    if (created.tasks > tasksBefore) created.notes += 1;
    else skipped.notes += 1;
  }

  for (const move of handoff.moveTasks) {
    const fromId = listIds[move.fromList];
    const toId = listIds[move.toList];
    if (!fromId || !toId) {
      throw new Error(`List inválida no move "${move.name}" (${move.fromList} → ${move.toList}).`);
    }
    const fromTask = findByName(tasksByList[move.fromList] ?? [], move.name);
    const toTask = findByName(tasksByList[move.toList] ?? [], move.name);
    if (toTask) {
      log(`move skipped (já em ${move.toList}): ${move.name}`);
      skipped.moved += 1;
      taskIds[move.name] = String(toTask.id);
      continue;
    }
    const task = fromTask;
    if (!task) {
      log(`move skipped (task ausente): ${move.name}`);
      skipped.moved += 1;
      continue;
    }
    const body = { move_custom_fields: true };
    await moveTaskToHomeList(client, {
      workspaceId: teamId,
      taskId: task.id,
      listId: toId,
      body,
    });
    if (move.status) {
      const resolved = resolveTaskStatus(move.status, statusesByList[move.toList] ?? []);
      if (resolved && String(task.status ?? "").toLowerCase() !== resolved.toLowerCase()) {
        await client.put(`/task/${task.id}`, { status: resolved });
      }
    }
    created.moved += 1;
    log(`moved task: ${move.name} → ${move.toList}`);
    taskIds[move.name] = String(task.id);
    if (tasksByList[move.toList]) {
      const idx = tasksByList[move.toList].findIndex((item) => String(item.id) === String(task.id));
      if (idx < 0) tasksByList[move.toList].push({ ...task, ...body });
    }
    const fromList = tasksByList[move.fromList] ?? [];
    tasksByList[move.fromList] = fromList.filter((item) => String(item.id) !== String(task.id));
  }

  for (const taskCfg of handoff.tasks) {
    const listId = listIds[taskCfg.list];
    if (!listId) {
      throw new Error(`List "${taskCfg.list}" não encontrada para task "${taskCfg.name}".`);
    }
    await upsertTask({
      client,
      taskCfg,
      listName: taskCfg.list,
      listId,
      listFields: fieldByList[taskCfg.list] ?? [],
      listStatuses: statusesByList[taskCfg.list] ?? [],
      existingTasks: tasksByList[taskCfg.list] ?? [],
      log,
      counters: created,
      taskIds,
    });
  }

  return {
    spaceId: workspace.spaceId,
    listIds,
    taskIds,
    created,
    skipped,
    nextStep:
      "manual opcional: GitHub OAuth (setup.md §3) e ajuste de statuses customizados na UI ClickUp",
  };
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

  const handoffPath = resolve(cwd, env.CLICKUP_HANDOFF_CONFIG || DEFAULT_HANDOFF_CONFIG_PATH);
  if (!exists(handoffPath)) {
    stderr(missingClickUpConfigMessage(handoffPath, DEFAULT_HANDOFF_CONFIG_EXAMPLE_PATH));
    return 1;
  }

  let handoff;
  try {
    handoff = parseHandoffConfig(JSON.parse(readFile(handoffPath, "utf8")));
  } catch (error) {
    stderr(error.message);
    return 1;
  }

  const client = createClickUpClient({
    token: credentials.CLICKUP_API_TOKEN,
    fetchImpl,
  });

  try {
    const summary = await sprintHandoffClickUp({
      client,
      teamId: credentials.CLICKUP_TEAM_ID,
      handoff,
      log: stdout,
    });
    stdout(JSON.stringify(summary, null, 2));
    stdout(summary.nextStep);
    return 0;
  } catch (error) {
    stderr(String(error.message));
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
