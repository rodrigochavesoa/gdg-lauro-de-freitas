-- Registra a decisão do PO para disponibilizar F-11 em Production e Homolog.
-- A escolha de publicar continua opcional, separada e desligada para cada perfil.
-- Nenhuma conta ou projeção é criada por esta migration.

insert into public.privacy_purposes (
  purpose_code, version, title, specific_description, classification, status,
  legal_basis_status, retention_status, text_status, revocation_effect
) values (
  'F-11', 3,
  'Compartilhar seu perfil profissional na Comunidade GDG Jobs',
  'Por escolha opcional e desligada por padrão, exibir aos membros autenticados da Comunidade GDG Jobs o nome, foto de perfil (se houver), título profissional, competências, localização, experiência, modelo de trabalho, apresentação e links profissionais para descoberta e conexões. Não exibir e-mail, telefone, currículo, UID, papel ou preferências privadas. A publicação permanece enquanto o titular mantiver o opt-in; revogação ou exclusão da conta remove a projeção e bloqueia novas entregas do avatar. Cópias já obtidas por membros não podem ser recolhidas.',
  'optional_consent', 'active', 'approved', 'approved', 'approved',
  'Retirar a publicação remove o perfil das consultas da Comunidade e bloqueia novas entregas da foto; URLs ou cópias já obtidas por terceiros não podem ser recolhidas.'
)
on conflict (purpose_code, version) do update set
  title = excluded.title,
  specific_description = excluded.specific_description,
  classification = excluded.classification,
  status = excluded.status,
  legal_basis_status = excluded.legal_basis_status,
  retention_status = excluded.retention_status,
  text_status = excluded.text_status,
  revocation_effect = excluded.revocation_effect;

-- Production uses the formal F-11 approval, not the temporary pilot bypass.
update private.community_pilot_settings
set enabled = false, updated_at = clock_timestamp()
where singleton;

notify pgrst, 'reload schema';
