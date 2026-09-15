import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SkipLink } from "./SkipLink.jsx";

describe("SkipLink", () => {
  it("aponta para o landmark de conteúdo", () => {
    render(<SkipLink />);
    expect(screen.getByRole("link", { name: "Ir para o conteúdo" })).toHaveAttribute("href", "#conteudo");
  });
});
