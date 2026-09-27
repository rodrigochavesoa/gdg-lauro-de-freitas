import { describe, expect, it } from "vitest";
import { mergeById } from "./merge-by-id.js";

describe("mergeById", () => {
  it("devolve a lista atual quando não chega nada", () => {
    const current = [{ id: "a" }, { id: "b" }];
    expect(mergeById(current, [])).toEqual(current);
    expect(mergeById([], [])).toEqual([]);
    expect(mergeById([], [{ id: "a" }, { id: "b" }])).toEqual([{ id: "a" }, { id: "b" }]);
  });

  it("anexa só ids novos e preserva a ordem", () => {
    const current = [{ id: 1, label: "primeira" }, { id: "2", label: "segunda" }];
    const incoming = [
      { id: "2", label: "duplicata" },
      { id: 3, label: "terceira" },
      { id: "1", label: "também duplicata" },
    ];
    expect(mergeById(current, incoming)).toEqual([
      { id: 1, label: "primeira" },
      { id: "2", label: "segunda" },
      { id: 3, label: "terceira" },
    ]);
  });
});
