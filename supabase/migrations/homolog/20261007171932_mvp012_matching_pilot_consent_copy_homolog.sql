-- F-06 v2 makes the deterministic, browser-only and non-persistent processing
-- explicit before the Preview pilot can use a fresh individual acceptance.
update public.privacy_purposes
set status = 'inactive'
where purpose_code = 'F-06'
  and status = 'active'
  and version < 2;

insert into public.privacy_purposes (
  purpose_code, version, title, specific_description, classification, status,
  legal_basis_status, retention_status, text_status, revocation_effect
) values (
  'F-06', 2,
  'Receber recomendações com base no perfil',
  'Usar suas skills, nível, localidade, modalidade e preferências para ordenar vagas relevantes. O cálculo determinístico acontece no navegador; pontuações e ordenação personalizada não são armazenadas. Esta escolha é opcional e revogável.',
  'optional_consent', 'active', 'pending_dpo', 'pending_dpo', 'pending_dpo',
  'Desligar remove recomendações personalizadas futuras; catálogo, busca, filtros e candidatura continuam disponíveis.'
)
on conflict (purpose_code, version) do nothing;
