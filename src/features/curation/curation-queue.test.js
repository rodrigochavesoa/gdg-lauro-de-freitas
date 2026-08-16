import { describe, expect, it } from "vitest";
import { mergeCurationQueue } from "./curation-queue.js";

describe("mergeCurationQueue", () => {
  it("coloca urgent antes de normal e marca empate", () => {
    const queue = mergeCurationQueue(
      [
        { id: "n", title: "Normal", priority: "normal", created_at: "2026-08-16T12:00:00Z" },
        { id: "u", title: "Urgente", priority: "urgent", created_at: "2026-08-16T10:00:00Z" },
        { id: "n2", title: "Mais nova", priority: "normal", created_at: "2026-08-16T13:00:00Z" },
      ],
      ["n"],
    );
    expect(queue.map((job) => job.id)).toEqual(["u", "n2", "n"]);
    expect(queue.find((job) => job.id === "n").needsModeration).toBe(true);
    expect(queue.find((job) => job.id === "u").needsModeration).toBe(false);
  });
});
