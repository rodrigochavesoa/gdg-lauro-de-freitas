import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Footer } from "./Footer.jsx";

describe("Footer", () => {
  it("mantém o chrome do Login: markup único e CSS global sem hairline", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /GDG Jobs/i })).toHaveAttribute("href", "/");
    expect(screen.getByText(/Feito com a comunidade GDG/)).toBeInTheDocument();

    const css = readFileSync(resolve("src/styles.css"), "utf8");
    expect(css).toMatch(/footer\{border-top:none/);
    expect(css).toMatch(/body:has\(\.jobs-layout\) footer/);
    expect(css).not.toMatch(/footer\{border-top:1px solid/);
  });
});
