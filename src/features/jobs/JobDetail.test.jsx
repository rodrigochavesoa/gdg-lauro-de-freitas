import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobDetail } from "./JobDetail.jsx";
import { jobDetailBackFrom, jobDetailBackLabel } from "./job-detail-nav.js";

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
    expect(screen.getByRole("button", { name: /Verificando candidatura/i })).toHaveClass("outline");
    expect(screen.getByRole("button", { name: /Verificando candidatura/i })).not.toHaveClass("primary");
    expect(screen.queryByRole("button", { name: /Candidatar-se com 1 clique/i })).not.toBeInTheDocument();
  });

  it("não mostra CTA azul quando a verificação da candidatura falha", () => {
    render(
      <JobDetail
        job={job}
        goBack={() => {}}
        logged
        applicationStatus={null}
        applicationCheckFailed
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível verificar candidatura.");
    expect(screen.queryByRole("button", { name: /Candidatar-se com 1 clique/i })).not.toBeInTheDocument();
  });

  it("em partial mostra título e skeleton de conteúdo sem inventar description", () => {
    const partial = {
      ...job,
      description: undefined,
      about: undefined,
      responsibilities: undefined,
    };
    render(
      <JobDetail
        job={partial}
        isPartial
        goBack={() => {}}
        logged={false}
        applicationStatus={null}
      />,
    );
    expect(screen.getByRole("heading", { name: job.title })).toBeInTheDocument();
    expect(screen.getByText(job.company)).toBeInTheDocument();
    expect(screen.queryByText("Fictícia")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".detail-skeleton-block").length).toBeGreaterThan(0);
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
  });

  it("partial logado mantém Verificando e não flasha CTA azul", () => {
    render(
      <JobDetail
        job={job}
        isPartial
        goBack={() => {}}
        logged
        applicationStatus={null}
        applicationLoading
      />,
    );
    expect(screen.getByRole("button", { name: /Verificando candidatura/i })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Candidatar-se com 1 clique/i })).not.toBeInTheDocument();
  });

  it("usa o rótulo contextual no botão voltar", () => {
    render(
      <JobDetail
        job={job}
        goBack={() => {}}
        backLabel="Voltar para minhas candidaturas"
        logged={false}
        applicationStatus={null}
      />,
    );
    expect(screen.getByRole("button", { name: "Voltar para minhas candidaturas" })).toHaveClass("back");
    expect(screen.queryByRole("button", { name: /Voltar para vagas/i })).not.toBeInTheDocument();
  });

  it("jobDetailBackFrom nunca devolve o portal", () => {
    expect(jobDetailBackFrom("/minhas-candidaturas")).toBe("/minhas-candidaturas");
    expect(jobDetailBackFrom("/vagas")).toBe("/vagas");
    expect(jobDetailBackFrom("/")).toBe("/vagas");
    expect(jobDetailBackFrom(undefined)).toBe("/vagas");
    expect(jobDetailBackLabel("/minhas-candidaturas")).toBe("Voltar para minhas candidaturas");
    expect(jobDetailBackLabel("/vagas")).toBe("Voltar para vagas");
  });
});
