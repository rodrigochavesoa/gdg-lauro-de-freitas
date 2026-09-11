import { describe, expect, it, vi } from "vitest";
import {
  bootstrapClickUp,
  buildSummary,
  createClickUpClient,
  customFieldPayload,
  findByName,
  hasCredentials,
  loadClickUpEnvFromFiles,
  main,
  missingCredentialsMessage,
  NEXT_STEP_MANUAL,
  parseBootstrapConfig,
  parseEnvFile,
  pickClickUpEnv,
  resolveDropdownValue,
  resolveTaskStatus,
} from "./bootstrap-clickup.mjs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

function createMemoryClickUp() {
  let seq = 1;
  const store = {
    spaces: [],
    foldersBySpace: {},
    listsByFolder: {},
    fieldsByList: {},
    tasksByList: {},
    comments: [],
    fieldValues: [],
    spaceTags: [],
    taskTags: [],
    updates: [],
    members: [{ user: { id: 42, username: "Ada Lovelace", email: "ada@example.com" } }],
  };

  function id() {
    const value = String(seq);
    seq += 1;
    return value;
  }

  const fetchImpl = vi.fn(async (url, init = {}) => {
    const method = (init.method || "GET").toUpperCase();
    const parsed = new URL(url, "https://api.clickup.com");
    const path = parsed.pathname.replace(/^\/api\/v2/, "");
    const body = init.body ? JSON.parse(init.body) : {};

    const teamSpace = path.match(/^\/team\/([^/]+)\/space$/);
    if (teamSpace && method === "GET") {
      return jsonResponse({ spaces: store.spaces });
    }
    if (teamSpace && method === "POST") {
      const space = { id: id(), name: body.name };
      store.spaces.push(space);
      store.foldersBySpace[space.id] = [];
      return jsonResponse(space);
    }

    const spaceFolder = path.match(/^\/space\/([^/]+)\/folder$/);
    if (spaceFolder && method === "GET") {
      return jsonResponse({ folders: store.foldersBySpace[spaceFolder[1]] ?? [] });
    }
    if (spaceFolder && method === "POST") {
      const folder = { id: id(), name: body.name };
      (store.foldersBySpace[spaceFolder[1]] ??= []).push(folder);
      store.listsByFolder[folder.id] = [];
      return jsonResponse(folder);
    }

    const spaceTag = path.match(/^\/space\/([^/]+)\/tag$/);
    if (spaceTag && method === "GET") {
      return jsonResponse({ tags: store.spaceTags });
    }
    if (spaceTag && method === "POST") {
      store.spaceTags.push(body.tag ?? body);
      return jsonResponse({});
    }

    const teamOnly = path.match(/^\/team\/([^/]+)$/);
    if (teamOnly && method === "GET") {
      return jsonResponse({ members: store.members });
    }

    const folderList = path.match(/^\/folder\/([^/]+)\/list$/);
    if (folderList && method === "GET") {
      return jsonResponse({ lists: store.listsByFolder[folderList[1]] ?? [] });
    }
    if (folderList && method === "POST") {
      const list = { id: id(), name: body.name, statuses: body.statuses ?? [] };
      (store.listsByFolder[folderList[1]] ??= []).push(list);
      store.fieldsByList[list.id] = [];
      store.tasksByList[list.id] = [];
      return jsonResponse(list);
    }

    const listField = path.match(/^\/list\/([^/]+)\/field$/);
    if (listField && method === "GET") {
      return jsonResponse({ fields: store.fieldsByList[listField[1]] ?? [] });
    }
    if (listField && method === "POST") {
      const options = (body.type_config?.options ?? []).map((option, index) => ({
        id: `opt-${id()}`,
        name: option.name,
        orderindex: index,
      }));
      const field = {
        id: `field-${id()}`,
        name: body.name,
        type: body.type,
        type_config: { options },
      };
      (store.fieldsByList[listField[1]] ??= []).push(field);
      return jsonResponse({ id: field.id, field });
    }

    const listOnly = path.match(/^\/list\/([^/]+)$/);
    if (listOnly && method === "GET") {
      for (const lists of Object.values(store.listsByFolder)) {
        const list = lists.find((item) => String(item.id) === String(listOnly[1]));
        if (list) {
          return jsonResponse({
            id: list.id,
            name: list.name,
            statuses:
              list.statuses?.length > 0
                ? list.statuses
                : [
                    { status: "to do", type: "open" },
                    { status: "complete", type: "closed" },
                  ],
          });
        }
      }
      return jsonResponse({ err: "list not found" }, 404);
    }

    const listTask = path.match(/^\/list\/([^/]+)\/task$/);
    if (listTask && method === "GET") {
      return jsonResponse({ tasks: store.tasksByList[listTask[1]] ?? [], last_page: true });
    }
    if (listTask && method === "POST") {
      const task = {
        id: id(),
        name: body.name,
        status: body.status,
        assignees: [],
        tags: [],
        start_date: null,
        custom_fields: [],
      };
      (store.tasksByList[listTask[1]] ??= []).push(task);
      return jsonResponse(task);
    }

    const taskPut = path.match(/^\/task\/([^/]+)$/);
    if (taskPut && method === "PUT") {
      store.updates.push({ taskId: taskPut[1], body });
      for (const tasks of Object.values(store.tasksByList)) {
        const task = tasks.find((item) => String(item.id) === String(taskPut[1]));
        if (!task) continue;
        if (body.assignees?.add) {
          task.assignees = [
            ...(task.assignees ?? []),
            ...body.assignees.add.map((assigneeId) => ({ id: assigneeId })),
          ];
        }
        if (body.start_date) task.start_date = body.start_date;
        if (body.description) task.description = body.description;
      }
      return jsonResponse({ id: taskPut[1] });
    }

    const taskTag = path.match(/^\/task\/([^/]+)\/tag\/(.+)$/);
    if (taskTag && method === "POST") {
      const name = decodeURIComponent(taskTag[2]);
      store.taskTags.push({ taskId: taskTag[1], name });
      for (const tasks of Object.values(store.tasksByList)) {
        const task = tasks.find((item) => String(item.id) === String(taskTag[1]));
        if (task) task.tags = [...(task.tags ?? []), { name }];
      }
      return jsonResponse({});
    }

    const taskField = path.match(/^\/task\/([^/]+)\/field\/([^/]+)$/);
    if (taskField && method === "POST") {
      store.fieldValues.push({
        taskId: taskField[1],
        fieldId: taskField[2],
        value: body.value,
      });
      return jsonResponse({});
    }

    const taskComment = path.match(/^\/task\/([^/]+)\/comment$/);
    if (taskComment && method === "POST") {
      store.comments.push({ taskId: taskComment[1], comment_text: body.comment_text });
      return jsonResponse({ id: id() });
    }

    return jsonResponse({ err: `unexpected ${method} ${path}` }, 404);
  });

  return { fetchImpl, store };
}

function sampleConfig() {
  return parseBootstrapConfig({
    space: { name: "Meu Produto MVP" },
    folders: [
      { name: "Product Backlog", lists: [] },
      {
        name: "Sprints",
        lists: [{ name: "Sprint 01" }, { name: "Sprint 02" }],
      },
      { name: "Ops / Bloqueios", lists: [] },
    ],
    listStatuses: [
      { status: "Backlog", type: "open", color: "#87909e" },
      { status: "Done", type: "closed", color: "#2ea44f" },
      { status: "Blocked", type: "custom", color: "#e5484d" },
    ],
    customFields: [
      { name: "História ID", type: "short_text" },
      { name: "Veredito Plan", type: "drop_down", options: ["APROVADO", "—"] },
    ],
    defaults: { assignee: { email: "ada@example.com" } },
    tasks: [
      {
        list: "Sprint 01",
        name: "Exemplo — entrega concluída",
        status: "Done",
        tags: ["Frontend", "UX"],
        openedAt: "2026-01-10",
        closedAt: "2026-01-20",
        fields: { "História ID": "EXEMPLO-DONE", "Veredito Plan": "APROVADO" },
        description: "Task de exemplo.",
        comment: "Merge em main.",
      },
    ],
  });
}

function clientFrom(fetchImpl) {
  return {
    get: (path) => call(fetchImpl, "GET", path),
    post: (path, body) => call(fetchImpl, "POST", path, body),
    put: (path, body) => call(fetchImpl, "PUT", path, body),
  };
}

async function call(fetchImpl, method, path, body) {
  const res = await fetchImpl(`https://api.clickup.com/api/v2${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return data;
}

describe("parser de env e config", () => {
  it("parseEnvFile ignora comentários e aspas", () => {
    const env = parseEnvFile(`
# token
CLICKUP_API_TOKEN="abc"
CLICKUP_TEAM_ID=123456
VITE_OTHER=nope
`);
    expect(env.CLICKUP_API_TOKEN).toBe("abc");
    expect(env.CLICKUP_TEAM_ID).toBe("123456");
    expect(env.VITE_OTHER).toBe("nope");
  });

  it("pickClickUpEnv só mantém CLICKUP_* preenchidas", () => {
    expect(pickClickUpEnv({ CLICKUP_API_TOKEN: " t ", VITE_X: "1", CLICKUP_TEAM_ID: "" })).toEqual({
      CLICKUP_API_TOKEN: "t",
    });
  });

  it("createClickUpClient retenta 429 e segue", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n += 1;
      if (n === 1) {
        return {
          ok: false,
          status: 429,
          headers: { get: () => "0" },
          text: async () => JSON.stringify({ err: "Rate limit reached" }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify({ ok: true }),
      };
    });
    const client = createClickUpClient({ token: "t", fetchImpl });
    await expect(client.get("/team/1")).resolves.toEqual({ ok: true });
    expect(n).toBe(2);
  });

  it("loadClickUpEnvFromFiles lê clickup.env e cai para .env.local só com CLICKUP_*", () => {
    const files = {
      [resolve("/repo", "docs-local/clickup.env")]: "CLICKUP_API_TOKEN=from-clickup\nCLICKUP_TEAM_ID=1\n",
    };
    const first = loadClickUpEnvFromFiles({
      cwd: "/repo",
      exists: (path) => Boolean(files[path]),
      readFile: (path) => files[path],
    });
    expect(first).toEqual({ CLICKUP_API_TOKEN: "from-clickup", CLICKUP_TEAM_ID: "1" });

    const fallbackFiles = {
      [resolve("/repo", ".env.local")]: "CLICKUP_API_TOKEN=from-local\nVITE_SUPABASE_URL=https://example.com\n",
    };
    const fallback = loadClickUpEnvFromFiles({
      cwd: "/repo",
      exists: (path) => Boolean(fallbackFiles[path]),
      readFile: (path) => fallbackFiles[path],
    });
    expect(fallback).toEqual({ CLICKUP_API_TOKEN: "from-local" });
    expect(fallback.VITE_SUPABASE_URL).toBeUndefined();
  });

  it("hasCredentials exige token e team id", () => {
    expect(hasCredentials({})).toBe(false);
    expect(hasCredentials({ CLICKUP_API_TOKEN: "x" })).toBe(false);
    expect(hasCredentials({ CLICKUP_API_TOKEN: "x", CLICKUP_TEAM_ID: "1" })).toBe(true);
  });

  it("parseBootstrapConfig valida space, folders, fields e tasks", () => {
    expect(() => parseBootstrapConfig({})).toThrow(/space.name/);
    expect(() => parseBootstrapConfig({ space: { name: "X" }, folders: [] })).toThrow(/folders/);
    const cfg = sampleConfig();
    expect(cfg.space.name).toBe("Meu Produto MVP");
    expect(cfg.folders).toHaveLength(3);
    expect(cfg.customFields).toHaveLength(2);
    expect(cfg.tasks[0].name).toContain("Exemplo");
  });

  it("fixture bootstrap.config.json é válido", () => {
    const raw = JSON.parse(
      readFileSync(resolve("scripts/fixtures/clickup/bootstrap.config.json"), "utf8"),
    );
    const cfg = parseBootstrapConfig(raw);
    expect(cfg.space.name).toBe("Meu Produto MVP");
    expect(cfg.folders[0].name).toBe("Sprints");
    expect(cfg.tasks).toHaveLength(1);
    expect(cfg.tasks[0].name.startsWith("Exemplo")).toBe(true);
  });
});

describe("lógica idempotente", () => {
  it("findByName faz match exato por título e ignora trim", () => {
    const items = [{ id: "1", name: "Sprint 01" }];
    expect(findByName(items, " Sprint 01 ").id).toBe("1");
    expect(findByName(items, "Sprint 02")).toBeNull();
  });

  it("resolveTaskStatus mapeia Done/Blocked para complete/to do quando a List só tem o padrão da API", () => {
    const defaults = [
      { status: "to do", type: "open" },
      { status: "complete", type: "closed" },
    ];
    expect(resolveTaskStatus("Done", defaults)).toBe("complete");
    expect(resolveTaskStatus("Blocked", defaults)).toBe("to do");
    expect(resolveTaskStatus("Done", [{ status: "Done", type: "closed" }])).toBe("Done");
  });

  it("resolveDropdownValue usa id da opção pelo nome", () => {
    const field = {
      type: "drop_down",
      type_config: { options: [{ id: "opt-a", name: "APROVADO" }, { id: "opt-b", name: "—" }] },
    };
    expect(resolveDropdownValue(field, "APROVADO")).toBe("opt-a");
    expect(resolveDropdownValue(field, "P0")).toBeNull();
  });

  it("customFieldPayload monta drop_down com options", () => {
    const payload = customFieldPayload({
      name: "Prioridade",
      type: "drop_down",
      options: ["P0", "P1"],
    });
    expect(payload.type_config.options.map((option) => option.name)).toEqual(["P0", "P1"]);
  });

  it("primeira execução cria; segunda não duplica (skipped)", async () => {
    const { fetchImpl, store } = createMemoryClickUp();
    const client = clientFrom(fetchImpl);
    const config = sampleConfig();

    const first = await bootstrapClickUp({ client, teamId: "team-1", config });
    expect(first.created.spaces).toBe(1);
    expect(first.created.folders).toBe(3);
    expect(first.created.lists).toBe(2);
    expect(first.created.fields).toBe(4);
    expect(first.created.tasks).toBe(1);
    expect(first.skipped.spaces).toBe(0);
    expect(store.spaces).toHaveLength(1);
    expect(store.fieldValues.length).toBeGreaterThan(0);
    expect(store.comments).toHaveLength(1);
    expect(first.created.assignees).toBe(1);
    expect(first.created.tags).toBe(1);
    expect(store.taskTags.map((item) => item.name).sort()).toEqual(["Frontend", "UX"]);

    const second = await bootstrapClickUp({ client, teamId: "team-1", config });
    expect(second.created.spaces).toBe(0);
    expect(second.created.folders).toBe(0);
    expect(second.created.lists).toBe(0);
    expect(second.created.fields).toBe(0);
    expect(second.created.tasks).toBe(0);
    expect(second.skipped.spaces).toBe(1);
    expect(second.skipped.folders).toBe(3);
    expect(second.skipped.lists).toBe(2);
    expect(second.skipped.fields).toBe(4);
    expect(second.skipped.tasks).toBe(1);
    expect(second.skipped.assignees).toBe(1);
    expect(second.skipped.tags).toBe(1);
    expect(store.taskTags).toHaveLength(2);
    expect(store.spaces).toHaveLength(1);
    expect(Object.values(store.tasksByList).flat()).toHaveLength(1);
    expect(first.spaceId).toBe(second.spaceId);
    expect(first.taskIds).toEqual(second.taskIds);
  });

  it("se a API recusar statuses na List, cria a List só com o nome", async () => {
    const { fetchImpl } = createMemoryClickUp();
    const wrapped = vi.fn(async (url, init = {}) => {
      const method = (init.method || "GET").toUpperCase();
      const path = new URL(url, "https://api.clickup.com").pathname;
      const body = init.body ? JSON.parse(init.body) : {};
      if (method === "POST" && /\/folder\/[^/]+\/list$/.test(path) && body.statuses) {
        return jsonResponse({ err: "statuses not allowed" }, 400);
      }
      return fetchImpl(url, init);
    });
    const client = clientFrom(wrapped);
    const summary = await bootstrapClickUp({ client, teamId: "team-1", config: sampleConfig() });
    expect(summary.created.lists).toBe(2);
    expect(summary.created.tasks).toBe(1);
  });

  it("buildSummary inclui instrução de GitHub manual", () => {
    const summary = buildSummary({
      spaceId: "1",
      listIds: {},
      taskIds: {},
      created: { spaces: 0, folders: 0, lists: 0, fields: 0, tasks: 0 },
      skipped: { spaces: 1, folders: 0, lists: 0, fields: 0, tasks: 0 },
    });
    expect(summary.nextStep).toBe(NEXT_STEP_MANUAL);
    expect(summary.nextStep.toLowerCase()).toContain("github");
  });
});

describe("main sem credenciais", () => {
  it("sai 1 e não chama fetch se token/team ausentes", async () => {
    const fetchImpl = vi.fn();
    const errors = [];
    const code = await main({
      cwd: "/repo",
      env: {},
      exists: () => false,
      readFile: () => "",
      fetchImpl,
      stdout: () => {},
      stderr: (message) => errors.push(String(message)),
    });
    expect(code).toBe(1);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(errors.join(" ")).toContain("CLICKUP_API_TOKEN");
    expect(errors.join(" ")).toContain("CLICKUP_TEAM_ID");
    expect(missingCredentialsMessage()).toMatch(/docs-local\/clickup\.env/);
  });

  it("roda o bootstrap com env injetado e fetch mock (sem API real)", async () => {
    const { fetchImpl } = createMemoryClickUp();
    const logs = [];
    const files = {
      [resolve("/repo", "docs-local/clickup.env")]: "CLICKUP_API_TOKEN=test-token\nCLICKUP_TEAM_ID=99\n",
      [resolve("/repo", "docs-local/clickup/bootstrap.config.json")]: JSON.stringify({
        space: { name: "Meu Produto MVP" },
        folders: [{ name: "Sprints", lists: [{ name: "Sprint 02" }] }],
        customFields: [{ name: "PR", type: "short_text" }],
        tasks: [],
        listStatuses: [],
      }),
    };
    const code = await main({
      cwd: "/repo",
      env: {},
      exists: (path) => Boolean(files[path]),
      readFile: (path) => files[path],
      fetchImpl,
      stdout: (message) => logs.push(String(message)),
      stderr: () => {},
    });
    expect(code).toBe(0);
    expect(fetchImpl.mock.calls.every(([url]) => String(url).includes("api.clickup.com"))).toBe(true);
    const summaryLine = logs.find((line) => line.trim().startsWith("{"));
    const summary = JSON.parse(summaryLine);
    expect(summary.created.spaces).toBe(1);
    expect(summary.skipped.tasks).toBe(0);
    expect(logs.some((line) => line.includes("GitHub integration"))).toBe(true);
  });
});
