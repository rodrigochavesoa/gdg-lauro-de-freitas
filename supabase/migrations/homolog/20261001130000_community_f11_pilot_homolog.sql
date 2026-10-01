-- UX-COMMUNITY-PROFILES-01 — piloto Homolog/Preview: gate técnico F-11 v2.
-- Homologação: aplicar após held/20261001120000_ux_community_profiles_01.sql.
-- Produção: não aplicar. Fora de prod.manifest.json.
-- Exige registro operacional em docs-local/community-homolog-preview-pilot.md.
-- Habilita RPCs da Comunidade no banco de homolog; não promove schema nem F-11 para produção.
-- Reversão: UPDATE privacy_purposes F-11 v2 de volta a inactive/pending_dpo (ver runbook local).

update public.privacy_purposes
set status = 'active',
    legal_basis_status = 'approved',
    retention_status = 'approved',
    text_status = 'approved'
where purpose_code = 'F-11'
  and version = 2;
