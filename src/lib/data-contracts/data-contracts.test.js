import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { DETAIL_SURFACES, LIST_SURFACES, PRIVACY_PURPOSE_SELECT } from "./selects.js";
import {
  mapAdminJobFormRowToDto,
  mapAdminJobListRowToDto,
  mapApplicationDetailRowToDto,
  mapApplicationListRowToDto,
  mapCatalogDetailRowToDto,
  mapCatalogHeavyRowToDto,
  mapCatalogListRowToDto,
  mapCurationDetailRowToDto,
  mapCurationListRowToDto,
  mapCurationReviewRowToDto,
  mapIngestionDetailRowToDto,
  mapIngestionListRowToDto,
  mapPrivacyPurposeRowToDto,
  mapProfileRowToDto,
  selectIdentifiers,
} from "./map-row.js";

function sourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "node_modules") continue;
      files.push(...sourceFiles(path));
      continue;
    }
    if (/\.(js|jsx)$/.test(entry)) files.push(path);
  }
  return files;
}

describe("contratos de dados", () => {
  it("listas não incluem coluna de detalhe", () => {
    for (const surface of LIST_SURFACES) {
      const tokens = new Set(selectIdentifiers(surface.select));
      const hits = surface.forbidden.filter((token) => tokens.has(token));
      expect(hits, surface.id).toEqual([]);
    }
  });

  it("detalhe continua explícito nas colunas pesadas", () => {
    for (const surface of DETAIL_SURFACES) {
      const tokens = new Set(selectIdentifiers(surface.select));
      for (const token of surface.required) {
        expect(tokens.has(token), `${surface.id} ${token}`).toBe(true);
      }
    }
  });

  it("privacidade lista as colunas do catálogo sem select estrela", () => {
    expect(PRIVACY_PURPOSE_SELECT).not.toBe("*");
    expect(selectIdentifiers(PRIVACY_PURPOSE_SELECT)).toEqual(expect.arrayContaining([
      "purpose_code",
      "version",
      "title",
      "specific_description",
    ]));
  });

  it("src não usa select estrela", () => {
    const root = join(import.meta.dirname, "..", "..");
    const hits = [];
    for (const file of sourceFiles(root)) {
      const text = readFileSync(file, "utf8");
      if (/\.select\(\s*["']\*["']\s*\)/.test(text)) hits.push(relative(root, file));
    }
    expect(hits).toEqual([]);
  });

  it("mapper rejeita linha sem campo obrigatório", () => {
    expect(() => mapCatalogListRowToDto({ id: "1", title: "Vaga" })).toThrow(
      /contrato de dados: campo obrigatório ausente \(catalog\.list\.status\)/,
    );
    expect(() => mapIngestionListRowToDto({ id: "ing-1" })).toThrow(
      /contrato de dados: campo obrigatório ausente \(ingest\.list\.source_kind\)/,
    );
    expect(() => mapCatalogDetailRowToDto({ id: "1", title: "Vaga", requirements: {} })).toThrow(
      /contrato de dados: campo obrigatório ausente \(catalog\.detail\.description\)/,
    );
    expect(() => mapCatalogDetailRowToDto({ id: "1", title: "Vaga", description: "Texto" })).toThrow(
      /contrato de dados: campo obrigatório ausente \(catalog\.detail\.requirements\)/,
    );
    expect(() => mapCatalogHeavyRowToDto({ id: "1", description: "Texto" })).toThrow(
      /contrato de dados: campo obrigatório ausente \(catalog\.detail\.heavy\.requirements\)/,
    );
    expect(() => mapAdminJobFormRowToDto({ id: "1", title: "Vaga", status: "pending" })).toThrow(
      /contrato de dados: campo obrigatório ausente \(admin\.jobs\.form\.description\)/,
    );
    expect(() => mapCurationDetailRowToDto({ id: "1", stack: [] })).toThrow(
      /contrato de dados: campo obrigatório ausente \(curation\.detail\.description\)/,
    );
    expect(() => mapIngestionDetailRowToDto({ id: "ing-1" })).toThrow(
      /contrato de dados: campo obrigatório ausente \(ingest\.detail\.canonical_payload\)/,
    );
    expect(() => mapApplicationDetailRowToDto({ id: "a1", job_id: "j1", status: "submitted" })).toThrow(
      /contrato de dados: campo obrigatório ausente \(applications\.detail\.snapshot\)/,
    );
  });

  it("DTO de lista não repassa coluna sensível que veio a mais", () => {
    const catalog = mapCatalogListRowToDto({
      id: "1",
      title: "Vaga",
      status: "approved",
      description: "não pode vazar",
      requirements: { mandatory: ["segredo"] },
      companies: { name: "Acme", description: "sobre" },
      internal_comment: "interno",
    });
    expect(catalog).not.toHaveProperty("description");
    expect(catalog).not.toHaveProperty("requirements");
    expect(catalog).not.toHaveProperty("internal_comment");
    expect(catalog.companies).toEqual({ name: "Acme" });

    const admin = mapAdminJobListRowToDto({
      id: "1",
      title: "Vaga",
      status: "pending",
      description: "não pode vazar",
      job_curation_reviews: [{ decision: "approve", internal_comment: "interno" }],
      companies: { name: "Acme", description: "sobre" },
    });
    expect(admin).not.toHaveProperty("description");
    expect(admin).not.toHaveProperty("job_curation_reviews");
    expect(admin.companies).toEqual({ name: "Acme" });

    const curation = mapCurationListRowToDto({
      id: "1",
      title: "Vaga",
      status: "pending",
      description: "não pode vazar",
      requirements: {},
    });
    expect(curation).not.toHaveProperty("description");
    expect(curation).not.toHaveProperty("requirements");

    const ingest = mapIngestionListRowToDto({
      id: "ing-1",
      source_kind: "manual_fixture",
      normalized_locator: "fixture:1",
      created_at: "2026-09-20T00:00:00.000Z",
      canonical_payload: { title: "segredo" },
      payload_hash: "abc",
      job_ingestion_attempts: [{ id: "t1", outcome: "failed" }],
    });
    expect(ingest).not.toHaveProperty("canonical_payload");
    expect(ingest).not.toHaveProperty("payload_hash");
    expect(ingest).not.toHaveProperty("job_ingestion_attempts");

    const application = mapApplicationListRowToDto({
      id: "a1",
      job_id: "j1",
      status: "submitted",
      snapshot: { full_name: "Ana" },
      jobs: { title: "Vaga", description: "longa", companies: { name: "Acme", description: "sobre" } },
    });
    expect(application).not.toHaveProperty("snapshot");
    expect(application.jobs).toEqual({ title: "Vaga", companies: { name: "Acme" } });
  });

  it("DTO de detalhe projeta só as colunas da superfície", () => {
    const detail = mapCatalogDetailRowToDto({
      id: "1",
      title: "Vaga",
      status: "approved",
      description: "Texto",
      requirements: { mandatory: ["React"] },
      companies: { name: "Acme", description: "Sobre", website: "https://secret.example" },
      internal_comment: "interno",
    });
    expect(detail.description).toBe("Texto");
    expect(detail.requirements).toEqual({ mandatory: ["React"] });
    expect(detail.companies).toEqual({ name: "Acme", description: "Sobre" });
    expect(detail).not.toHaveProperty("internal_comment");

    const form = mapAdminJobFormRowToDto({
      id: "1",
      title: "Vaga",
      status: "pending",
      description: "Texto",
      companies: { name: "Acme", description: "sobre" },
      job_curation_reviews: [{ decision: "reject", internal_comment: "nota", reviewer_email: "a@b.c" }],
      secret: true,
    });
    expect(form.companies).toEqual({ name: "Acme" });
    expect(form.job_curation_reviews).toEqual([{ decision: "reject", internal_comment: "nota" }]);
    expect(form).not.toHaveProperty("secret");

    const review = mapCurationReviewRowToDto({
      job_id: "1",
      decision: "approve",
      internal_comment: "nota",
      reviewer_email: "a@b.c",
    });
    expect(review.internal_comment).toBe("nota");
    expect(review).not.toHaveProperty("reviewer_email");

    const ingestion = mapIngestionDetailRowToDto({
      id: "ing-1",
      canonical_payload: { title: "Dev" },
      job_ingestion_attempts: [{ id: "t1", outcome: "failed", raw_body: "segredo" }],
      jobs: { id: "1", title: "Vaga", status: "pending", description: "longa" },
    });
    expect(ingestion.canonical_payload).toEqual({ title: "Dev" });
    expect(ingestion.job_ingestion_attempts).toEqual([{ id: "t1", outcome: "failed" }]);
    expect(ingestion.jobs).toEqual({ id: "1", title: "Vaga", status: "pending" });

    const application = mapApplicationDetailRowToDto({
      id: "a1",
      job_id: "j1",
      status: "submitted",
      snapshot: { full_name: "Ana" },
      email: "ana@example.invalid",
    });
    expect(application.snapshot).toEqual({ full_name: "Ana" });
    expect(application).not.toHaveProperty("email");

    const profile = mapProfileRowToDto({
      id: "u1",
      full_name: "Ana",
      email: "ana@example.invalid",
    });
    expect(profile.full_name).toBe("Ana");
    expect(profile).not.toHaveProperty("email");
    expect(Object.keys(profile).sort()).toEqual(["full_name", "id"]);

    const purpose = mapPrivacyPurposeRowToDto({
      purpose_code: "F-01",
      version: 1,
      title: "Conta",
      proof: { token: "segredo" },
    });
    expect(purpose.title).toBe("Conta");
    expect(purpose).not.toHaveProperty("proof");
  });
});
