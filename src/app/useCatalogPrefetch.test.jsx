import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadApprovedJobsMock = vi.hoisted(() => vi.fn(async () => ({ jobs: [], count: 0 })));

vi.mock("../features/catalog/jobs-api.js", () => ({
  loadApprovedJobs: (...args) => loadApprovedJobsMock(...args),
}));

import { useCatalogPrefetch } from "./useCatalogPrefetch.js";

function Harness() {
  const prefetchCatalog = useCatalogPrefetch();
  return (
    <button type="button" onMouseEnter={prefetchCatalog} onFocus={prefetchCatalog}>
      Vagas
    </button>
  );
}

describe("useCatalogPrefetch", () => {
  beforeEach(() => {
    loadApprovedJobsMock.mockClear();
  });

  it("só aquece o catálogo quando o link de Vagas recebe intenção", () => {
    render(<Harness />);
    expect(loadApprovedJobsMock).not.toHaveBeenCalled();
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Vagas" }));
    expect(loadApprovedJobsMock).toHaveBeenCalledTimes(1);
  });
});
