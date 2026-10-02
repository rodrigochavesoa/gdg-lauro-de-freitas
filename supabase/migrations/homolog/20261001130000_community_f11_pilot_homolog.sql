-- UX-COMMUNITY-PROFILES-01 — habilita somente o gate técnico do piloto Homolog/Preview.
-- Homologação: aplicar após held/20261001120000_ux_community_profiles_01.sql.
-- Produção: não aplicar. Fora de prod.manifest.json.
-- Os estados formais de F-11 permanecem pending_dpo; o gate genérico nunca autoriza.

update private.community_pilot_settings
set enabled = true, updated_at = clock_timestamp()
where singleton;

update public.privacy_purposes
set status = 'active',
    legal_basis_status = 'pending_dpo',
    retention_status = 'pending_dpo',
    text_status = 'pending_dpo'
where purpose_code = 'F-11'
  and version = 2;
