import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobDetail } from "./JobDetail.jsx";

const job = {
  title: "Pessoa Desenvolvedora Front-end",
  company: "Nuvem Lauro Demo",
  logo: "NL",
  color: "#4285f4",
  level: "Pleno",
  place: "Brasil · Remoto",
  type: "Remoto",
  posted: "há 2 dias",
  stack: ["React"],
  salary: "A combinar",
  description: "Fictícia",
  about: "Empresa fictícia",
  responsibilities: ["Construir interfaces"],
};

describe("JobDetail apply", () => {
  it("clique no apply chama o adaptador quando há sessão", () => {
    const onApply = vi.fn();
    render(
      <JobDetail
        job={job}
        goBack={() => {}}
        logged
        onApply={onApply}
        applicationStatus={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Candidatar-se com 1 clique/i }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("não mostra CTA azul enquanto verifica candidatura", () => {
    render(
      <JobDetail
        job={job}
        goBack={() => {}}
        logged
        applicationStatus={null}
        applicationLoading
      />,
    );
    expect(screen.getByRole("button", { name: /Verificando candidatura/i })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Candidatar-se com 1 clique/i })).not.toBeInTheDocument();
  });
});
