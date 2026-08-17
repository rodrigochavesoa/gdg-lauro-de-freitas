import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const startGoogleOAuth = vi.fn(async () => {});

vi.mock("./auth-api.js", () => ({
  startGoogleOAuth: (...args) => startGoogleOAuth(...args),
}));

import { Login } from "./Login.jsx";

describe("Login", () => {
  it("inicia OAuth Google pelo adaptador, sem client no JSX", async () => {
    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: /Continuar com Google/i }));
    expect(startGoogleOAuth).toHaveBeenCalledTimes(1);
  });
});
