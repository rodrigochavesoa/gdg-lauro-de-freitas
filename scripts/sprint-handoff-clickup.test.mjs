import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  main,
  parseHandoffConfig,
  sprintHandoffClickUp,
} from "./sprint-handoff-clickup.mjs";
import { createClickUpClient } from "./bootstrap-clickup.mjs";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

function seedWorkspace(store) {
  store.spaces = [{ id: "space-1", name: "Meu Produto MVP" }];
  store.foldersBySpace["space-1"] = [{ id: "folder-sprints", name: "Sprints" }];
  store.listsByFolder["folder-sprints"] = [
    {
      id: "list-01",
      name: "Sprint 01",
      statuses: [
        { status: "to do", type: "open" },
        { status: "complete", type: "closed" },
      ],
    },
    {
      id: "list-02",
      name: "Sprint 02",
      statuses: [
        { status: "to do", type: "open" },
        { status: "complete", type: "closed" },
      ],
    },
  ];
  store.fieldsByList["list-01"] = [{ id: "f1", name: "História ID", type: "text" }];
  store.fieldsByList["list-02"] = [{ id: "f2", name: "História ID", type: "text" }];
  store.tasksByList["list-01"] = [
    { id: "task-blocked", name: "Exemplo — credencial externa", status: "to do" },
  ];
  store.tasksByList["list-02"] = [];
}

function createHandoffMemory() {
  const store = {
    spaces: [],
    foldersBySpace: {},
    listsByFolder: {},
    fieldsByList: {},
    tasksByList: {},
    updates: [],
    comments: [],
    fieldValues: [],
  };

  seedWorkspace(store);

  const fetchImpl = vi.fn(async (url, init = {}) => {
    const method = (init.method || "GET").toUpperCase();
    const path = new URL(url, "https://api.clickup.com").pathname.replace(/^\/api\/v2/, "");
    const body = init.body ? JSON.parse(init.body) : {};

    if (path.match(/^\/team\/[^/]+\/space$/) && method === "GET") {
      return jsonResponse({ spaces: store.spaces });
    }
    if (path.match(/^\/space\/[^/]+\/folder$/) && method === "GET") {
      const spaceId = path.split("/")[2];
      return jsonResponse({ folders: store.foldersBySpace[spaceId] ?? [] });
    }
    if (path.match(/^\/folder\/[^/]+\/list$/) && method === "GET") {
      const folderId = path.split("/")[2];
      return jsonResponse({ lists: store.listsByFolder[folderId] ?? [] });
    }
    if (path.match(/^\/list\/[^/]+$/) && method === "GET") {
      const listId = path.split("/")[2];
      for (const lists of Object.values(store.listsByFolder)) {
        const list = lists.find((item) => item.id === listId);
        if (list) {
          return jsonResponse({ id: list.id, name: list.name, statuses: list.statuses });
        }
      }
      return jsonResponse({ err: "missing" }, 404);
    }
    if (path.match(/^\/list\/[^/]+\/field$/) && method === "GET") {
      const listId = path.split("/")[2];
      return jsonResponse({ fields: store.fieldsByList[listId] ?? [] });
    }
    if (path.match(/^\/list\/[^/]+\/task$/) && method === "GET") {
      const listId = path.split("/")[2];
      return jsonResponse({ tasks: store.tasksByList[listId] ?? [], last_page: true });
    }
    if (path.match(/^\/list\/[^/]+\/task$/) && method === "POST") {
      const listId = path.split("/")[2];
      const task = { id: `task-${Date.now()}`, name: body.name, status: body.status };
      (store.tasksByList[listId] ??= []).push(task);
      return jsonResponse(task);
    }
    if (path.match(/^\/task\/[^/]+$/) && method === "PUT") {
      const taskId = path.split("/")[2];
      store.updates.push({ taskId, body });
      for (const listId of Object.keys(store.tasksByList)) {
        const task = store.tasksByList[listId].find((item) => item.id === taskId);
        if (task) {
          Object.assign(task, body);
        }
      }
      return jsonResponse({ id: taskId });
    }
    if (path.match(/^\/api\/v3\/workspaces\/[^/]+\/tasks\/[^/]+\/home_list\/[^/]+$/) && method === "PUT") {
      const parts = path.split("/");
      const taskId = parts[6];
      const toListId = parts[8];
      store.updates.push({ taskId, toListId, move: true });
      for (const listId of Object.keys(store.tasksByList)) {
        const idx = store.tasksByList[listId].findIndex((item) => item.id === taskId);
        if (idx >= 0) {
          const [task] = store.tasksByList[listId].splice(idx, 1);
          (store.tasksByList[toListId] ??= []).push(task);
        }
      }
      return jsonResponse({ data: { task_id: taskId, new_list_id: toListId } });
    }
    if (path.match(/^\/task\/[^/]+\/comment$/) && method === "POST") {
      store.comments.push(body);
      return jsonResponse({ id: "c1" });
    }
    if (path.match(/^\/task\/[^/]+\/field\/[^/]+$/) && method === "POST") {
      store.fieldValues.push(body);
      return jsonResponse({});
    }
    return jsonResponse({ err: `unexpected ${method} ${path}` }, 404);
  });

  return { fetchImpl, store };
}

describe("parseHandoffConfig", () => {
  it("sprint-handoff.config.json versionado é válido", () => {
    const raw = JSON.parse(
      readFileSync(resolve("scripts/fixtures/clickup/sprint-handoff.config.json"), "utf8"),
    );
    const cfg = parseHandoffConfig(raw);
    expect(cfg.spaceName).toBe("Meu Produto MVP");
    expect(cfg.sprintNotes).toHaveLength(1);
    expect(cfg.moveTasks).toHaveLength(1);
    expect(cfg.tasks).toHaveLength(1);
  });
});

describe("sprintHandoffClickUp", () => {
  it("cria Sprint Note, move task e abre tasks da próxima list (idempotente na 2ª passagem)", async () => {
    const { fetchImpl, store } = createHandoffMemory();
    const client = createClickUpClient({ token: "t", fetchImpl });
    const handoff = parseHandoffConfig(
      JSON.parse(
        readFileSync(resolve("scripts/fixtures/clickup/sprint-handoff.config.json"), "utf8"),
      ),
    );

    const first = await sprintHandoffClickUp({ client, teamId: "1", handoff, log: () => {} });
    expect(first.created.notes).toBeGreaterThan(0);
    expect(first.created.moved).toBe(1);
    expect(store.tasksByList["list-01"].some((task) => task.name.includes("Sprint Note"))).toBe(true);
    expect(store.tasksByList["list-02"].some((task) => task.name.startsWith("Exemplo — credencial"))).toBe(
      true,
    );
    expect(store.tasksByList["list-01"].some((task) => task.name.startsWith("Exemplo — credencial"))).toBe(
      false,
    );

    const second = await sprintHandoffClickUp({ client, teamId: "1", handoff, log: () => {} });
    expect(second.created.moved).toBe(0);
    expect(second.skipped.moved).toBe(1);
    expect(store.tasksByList["list-02"].filter((task) => task.name.includes("próxima entrega")).length).toBe(
      1,
    );
  });
});

describe("main sprint-handoff", () => {
  it("sai 1 sem credenciais", async () => {
    const code = await main({
      cwd: "/repo",
      env: {},
      exists: () => false,
      readFile: () => "",
      fetchImpl: vi.fn(),
      stdout: () => {},
      stderr: () => {},
    });
    expect(code).toBe(1);
  });
});
