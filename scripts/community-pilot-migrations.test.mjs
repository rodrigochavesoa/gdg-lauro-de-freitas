import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const read = (path) => readFileSync(join(root, path), "utf8").replace(/\r\n/g, "\n");

const held = read("supabase/migrations/20261001120000_ux_community_profiles_01.sql");
const pilot = read("supabase/migrations/homolog/20261001130000_community_f11_pilot_homolog.sql");
const correction = read("supabase/migrations/homolog/20261001160000_community_pilot_gate_correction_homolog.sql");
const harness = read("scripts/check-rls.mjs");

function functionBody(source, name, nextMarker) {
  const start = source.indexOf(`create or replace function ${name}`);
  const end = source.indexOf(nextMarker, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("UX-COMMUNITY-PROFILES-01 pilot gate", () => {
  it("defaults the private flag off and keeps formal catalog states pending", () => {
    expect(held).toMatch(/enabled boolean not null default false/);
    expect(held).toMatch(/revoke all on table private\.community_pilot_settings from public, anon, authenticated, service_role/);
    expect(held).toMatch(/revoke all on function public\.set_community_pilot_enabled\(boolean\) from public, anon, authenticated/);
    expect(held).toMatch(/grant execute on function public\.set_community_pilot_enabled\(boolean\) to service_role/);
    expect(pilot + correction).toMatch(/legal_basis_status\s*=\s*'pending_dpo'/);
    expect(pilot + correction).toMatch(/retention_status\s*=\s*'pending_dpo'/);
    expect(pilot + correction).toMatch(/text_status\s*=\s*'pending_dpo'/);
  });

  it("preserves formal approval as an independent alternative to the pilot", () => {
    for (const name of ["private.community_purpose_enabled()", "private.community_subject_consented(p_subject_id uuid)"]) {
      const body = functionBody(held, name, "revoke all on function");
      expect(body).toMatch(/legal_basis_status\s*=\s*'approved'/);
      expect(body).toMatch(/retention_status\s*=\s*'approved'/);
      expect(body).toMatch(/text_status\s*=\s*'approved'/);
      expect(body).toMatch(/or private\.community_pilot_enabled\(\)/);
    }
    expect(held).toMatch(/v_purpose_approved\s*:=\s*v_purpose\.status\s*=\s*'active'[\s\S]*?or v_pilot_enabled/);
  });

  it("serializes publication against pilot disable and cleans only without formal approval", () => {
    expect(held).toMatch(/from private\.community_pilot_settings[\s\S]*?for share/);
    expect(held).toMatch(/old\.enabled and not new\.enabled and not exists \([\s\S]*?legal_basis_status = 'approved'[\s\S]*?retention_status = 'approved'[\s\S]*?text_status = 'approved'/);
    expect(held).toMatch(/delete from public\.community_profiles/);
    expect(held).toMatch(/effect', 'community_pilot_disabled'/);
  });

  it("keeps shared-Homolog scenarios read-only and confines opt-in mutation to isolated scenario 29", () => {
    const scenario28 = harness.slice(
      harness.indexOf("async function scenario28_communityProfilesFailClosed()"),
      harness.indexOf("async function scenario29_communityOptInFixture()"),
    );
    const scenario29 = harness.slice(
      harness.indexOf("async function scenario29_communityOptInFixture()"),
      harness.indexOf("async function scenario15_rpcExecuteHardening()"),
    );
    expect(scenario28).not.toMatch(/record_privacy_event|set_community_profile_publication|community_avatar_storage_path/);
    expect(scenario28).not.toMatch(/candidate\.rpc\("(?:get_community_feature_status|list_community_profiles|get_community_profile)"/);
    expect(scenario28).toMatch(/privacy_purpose_is_authorized/);
    expect(scenario28).toMatch(/diretamente/);
    expect(scenario29).toMatch(/UX_COMMUNITY_RLS_ISOLATED_PROJECT_REF/);
    expect(scenario29).toMatch(/knownSharedProjectRefs\.has\(isolatedRef\)/);
    expect(scenario29).toMatch(/set_community_pilot_enabled/);
    expect(scenario29).toMatch(/record_privacy_event|set_community_profile_publication/);
    expect(harness).not.toMatch(/cenário 28: piloto Homolog[\s\S]{0,100}ignorado/);

    const scenario16 = harness.slice(
      harness.indexOf("async function scenario16_privacyConsent()"),
      harness.indexOf("async function scenario17_") > 0 ? harness.indexOf("async function scenario17_") : harness.indexOf("async function scenario17"),
    );
    expect(scenario16).not.toMatch(/rpc\("record_privacy_event",\s*\{\s*p_purpose_code:\s*"F-11"/);
  });

  it("keeps a forward-only homolog correction after the already-applied 1500 migration", () => {
    expect(correction).toMatch(/Enable the explicitly authorized shared pilot before resetting old approved/);
    expect(correction).toMatch(/update private\.community_pilot_settings[\s\S]*?set enabled = true/);
    expect(correction).toMatch(/update public\.privacy_purposes[\s\S]*?legal_basis_status = 'pending_dpo'/);
    expect(correction).toMatch(/for share/);
  });
});
