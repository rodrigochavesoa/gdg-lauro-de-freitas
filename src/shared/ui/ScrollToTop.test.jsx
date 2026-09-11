import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, Link } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScrollToTop } from "./ScrollToTop.jsx";

describe("ScrollToTop", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("chama window.scrollTo(0, 0) ao montar e ao ir de /eventos para a landing", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={["/eventos"]}>
        <ScrollToTop />
        <Routes>
          <Route path="/eventos" element={<Link to="/eventos/devfest-lauro-de-freitas-2026">Ver evento</Link>} />
          <Route path="/eventos/:slug" element={<p>landing-evento</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    scrollTo.mockClear();

    fireEvent.click(screen.getByRole("link", { name: "Ver evento" }));
    expect(screen.getByText("landing-evento")).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
