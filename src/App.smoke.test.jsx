import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App.jsx";

describe("App smoke", () => {
  it("renderiza a home com busca e listagem de vagas", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /carreira em tech/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Cargo, tecnologia ou empresa")).toBeInTheDocument();
    expect(screen.getByText("4 oportunidades encontradas")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pessoa Desenvolvedora Front-end" })).toBeInTheDocument();
  });
});
