import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useNavigate } from "react-router-dom";

const loadApprovedJobsMock = vi.hoisted(() => vi.fn(async () => ({ jobs: [], count: 0 })));

vi.mock("../features/catalog/jobs-api.js", () => ({
  loadApprovedJobs: (...args) => loadApprovedJobsMock(...args),
}));

import { useCatalogPrefetch } from "./useCatalogPrefetch.js";

function Harness() {
  useCatalogPrefetch();
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/")}>
      Ir para a home
    </button>
  );
}

describe("useCatalogPrefetch", () => {
  beforeEach(() => {
    loadApprovedJobsMock.mockClear();
  });

  it("não aquece o catálogo em /admin e dispara uma vez fora da área admin", () => {
    render(
      <MemoryRouter initialEntries={["/admin/curadoria"]}>
        <Harness />
      </MemoryRouter>,
    );
    expect(loadApprovedJobsMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ir para a home" }));
    expect(loadApprovedJobsMock).toHaveBeenCalledTimes(1);
  });
});
