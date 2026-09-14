-- MVP-003: catálogo de finalidades e escolhas de privacidade.
-- Todas as bases, textos e retenções começam pendentes do DPO.
-- Rollback: ver docs-local/mvp-s3-consent-implementation-report.md.

create table public.privacy_purposes (
  purpose_code text not null check (purpose_code ~ '^F-[0-9]{2}$'),
  version integer not null check (version >= 1),
  title text not null check (length(trim(title)) > 0),
  specific_description text not null check (length(trim(specific_description)) > 0),
  classification text not null check (classification in ('necessary_notice', 'optional_consent')),
  status text not null default 'draft' check (status in ('draft', 'active', 'inactive', 'retired')),
  legal_basis_status text not null default 'pending_dpo' check (legal_basis_status in ('pending_dpo', 'approved', 'rejected')),
  retention_status text not null default 'pending_dpo' check (retention_status in ('pending_dpo', 'approved', 'rejected')),
  text_status text not null default 'pending_dpo' check (text_status in ('pending_dpo', 'approved', 'rejected')),
  revocation_effect text not null check (length(trim(revocation_effect)) > 0),
  created_at timestamptz not null default now(),
  primary key (purpose_code, version)
);

create unique index privacy_purposes_one_active_version_idx
  on public.privacy_purposes (purpose_code)
  where status = 'active';

create table public.privacy_consent_events (
  id uuid primary key default extensions.gen_random_uuid(),
  subject_id uuid not null references public.profiles(id) on delete cascade,
  purpose_code text not null,
  purpose_version integer not null,
  event_type text not null check (event_type in ('notice', 'accepted', 'refused', 'revoked')),
  source text not null check (source in ('preferences', 'onboarding', 'system')),
  proof jsonb not null default '{}'::jsonb check (jsonb_typeof(proof) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (purpose_code, purpose_version)
    references public.privacy_purposes (purpose_code, version)
);

create index privacy_consent_events_subject_created_idx
  on public.privacy_consent_events (subject_id, created_at desc);

create index privacy_consent_events_subject_purpose_idx
  on public.privacy_consent_events (subject_id, purpose_code, created_at desc);

alter table public.privacy_purposes enable row level security;
alter table public.privacy_consent_events enable row level security;

-- O catálogo não contém dados de titular. A escolha e o histórico são privados.
create policy "Finalidades: catálogo público"
  on public.privacy_purposes for select
  using (true);

create policy "Consentimentos: leitura própria"
  on public.privacy_consent_events for select
  using (subject_id = auth.uid());

revoke all on table public.privacy_purposes from public, anon, authenticated;
grant select on table public.privacy_purposes to anon, authenticated;

revoke all on table public.privacy_consent_events from public, anon, authenticated;
grant select on table public.privacy_consent_events to authenticated;

insert into public.privacy_purposes (
  purpose_code,
  version,
  title,
  specific_description,
  classification,
  status,
  legal_basis_status,
  retention_status,
  text_status,
  revocation_effect
) values
  (
    'F-01', 1, 'Criar e proteger sua conta',
    'Usar dados mínimos de autenticação para criar seu acesso, proteger a conta e ligá-la ao seu perfil.',
    'necessary_notice', 'active', 'pending_dpo', 'pending_dpo', 'pending_dpo',
    'Excluir a conta encerra o acesso; registros que precisarem ser mantidos seguirão a retenção aprovada.'
  ),
  (
    'F-02', 1, 'Manter seu perfil profissional',
    'Guardar os dados que você escolheu preencher para consultar, corrigir e usar seu perfil no GDG Jobs.',
    'necessary_notice', 'active', 'pending_dpo', 'pending_dpo', 'pending_dpo',
    'Você pode corrigir ou remover campos opcionais; o perfil pode ficar menos completo sem impedir o uso básico.'
  ),
  (
    'F-03', 1, 'Receber e acompanhar uma candidatura',
    'Registrar sua candidatura e compartilhar o snapshot permitido com a empresa anunciante da vaga.',
    'necessary_notice', 'active', 'pending_dpo', 'pending_dpo', 'pending_dpo',
    'Retirar a candidatura interrompe as próximas etapas permitidas; registros sujeitos a retenção aprovada podem permanecer.'
  ),
  (
    'F-04', 1, 'Receber notificações essenciais',
    'Informar mudanças de status, segurança e acontecimentos indispensáveis à sua conta ou candidatura.',
    'necessary_notice', 'inactive', 'pending_dpo', 'pending_dpo', 'pending_dpo',
    'Quando houver canal alternativo aprovado, você poderá ajustar a preferência; mensagens indispensáveis continuam necessárias.'
  ),
  (
    'F-05', 1, 'Receber a GDG Jobs Letter',
    'Enviar novidades, oportunidades e conteúdo editorial da comunidade por e-mail.',
    'optional_consent', 'inactive', 'pending_dpo', 'pending_dpo', 'pending_dpo',
    'Descadastrar-se impede novos envios e mantém somente a prova mínima necessária para evitar envio indevido.'
  ),
  (
    'F-06', 1, 'Receber recomendações com base no perfil',
    'Usar skills, nível, localidade, modalidade e preferências para sugerir vagas relevantes.',
    'optional_consent', 'active', 'pending_dpo', 'pending_dpo', 'pending_dpo',
    'Desligar remove recomendações personalizadas futuras; catálogo, busca, filtros e candidatura continuam disponíveis.'
  ),
  (
    'F-07', 1, 'Melhorar recomendações com eventos de uso',
    'Usar eventos mínimos, como vagas vistas ou salvas, para avaliar relevância e apoiar recomendações futuras.',
    'optional_consent', 'inactive', 'pending_dpo', 'pending_dpo', 'pending_dpo',
    'Desligar interrompe a coleta para recomendação e remove identificadores dos eventos quando possível.'
  ),
  (
    'F-08', 1, 'Calcular matching semântico com Gemini',
    'Enviar somente campos profissionais minimizados a Gemini para calcular proximidade com vagas aprovadas.',
    'optional_consent', 'inactive', 'pending_dpo', 'pending_dpo', 'pending_dpo',
    'Novos envios são bloqueados e derivados devem ser descartados conforme a política aprovada.'
  ),
  (
    'F-09', 1, 'Enriquecer vagas com Gemini',
    'Gerar rascunhos estruturados a partir do texto da vaga, mantendo o texto original como fonte editorial.',
    'optional_consent', 'inactive', 'pending_dpo', 'pending_dpo', 'pending_dpo',
    'A vaga pode ser publicada sem enriquecimento; remover a vaga deve impedir novos processamentos e eliminar derivados aprovados.'
  ),
  (
    'F-10', 1, 'Proteger e operar o serviço',
    'Registrar sinais técnicos mínimos para detectar erros, abuso e indisponibilidade, sem guardar payloads pessoais completos.',
    'necessary_notice', 'active', 'pending_dpo', 'pending_dpo', 'pending_dpo',
    'A camada estritamente necessária de segurança não é desligada; métricas opcionais devem ser separadas e revogáveis.'
  )
on conflict (purpose_code, version) do nothing;

create or replace function public.record_privacy_event(
  p_purpose_code text,
  p_event_type text,
  p_source text default 'preferences'
)
returns public.privacy_consent_events
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_purpose public.privacy_purposes%rowtype;
  v_event public.privacy_consent_events%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  if p_event_type not in ('notice', 'accepted', 'refused', 'revoked') then
    raise exception 'unsupported privacy event';
  end if;

  if p_source not in ('preferences', 'onboarding', 'system') then
    raise exception 'unsupported privacy event source';
  end if;

  select * into v_purpose
  from public.privacy_purposes
  where purpose_code = upper(trim(p_purpose_code))
    and status = 'active'
  order by version desc
  limit 1;

  if not found then
    raise exception 'privacy purpose is not active';
  end if;

  if v_purpose.classification = 'necessary_notice' and p_event_type <> 'notice' then
    raise exception 'necessary purpose accepts notice only';
  end if;

  if v_purpose.classification = 'optional_consent' and p_event_type = 'notice' then
    -- O aviso é registrado separadamente; não altera autorização.
    null;
  end if;

  if p_event_type = 'revoked' and coalesce((
    select event_type
    from public.privacy_consent_events
    where subject_id = v_uid
      and purpose_code = v_purpose.purpose_code
    order by created_at desc
    limit 1
  ), '') <> 'accepted' then
    raise exception 'privacy purpose is not currently accepted';
  end if;

  insert into public.privacy_consent_events (
    subject_id,
    purpose_code,
    purpose_version,
    event_type,
    source,
    proof
  ) values (
    v_uid,
    v_purpose.purpose_code,
    v_purpose.version,
    p_event_type,
    p_source,
    jsonb_build_object('source', p_source, 'purpose_version', v_purpose.version)
  )
  returning * into v_event;

  return v_event;
end;
$$;

create or replace function public.privacy_purpose_is_authorized(p_purpose_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with purpose as (
    select *
    from public.privacy_purposes
    where purpose_code = upper(trim(p_purpose_code))
      and status = 'active'
    order by version desc
    limit 1
  ), latest_event as (
    select e.event_type, e.purpose_version
    from public.privacy_consent_events e
    where e.subject_id = auth.uid()
      and e.purpose_code = upper(trim(p_purpose_code))
    order by e.created_at desc
    limit 1
  )
  select coalesce((
    select case
      when p.classification = 'necessary_notice' then true
      else p.status = 'active'
        and p.legal_basis_status = 'approved'
        and p.retention_status = 'approved'
        and p.text_status = 'approved'
        and exists (
          select 1
          from latest_event e
          where e.event_type = 'accepted'
            and e.purpose_version = p.version
        )
    end
    from purpose p
  ), false);
$$;

revoke all on function public.record_privacy_event(text, text, text) from public, anon;
grant execute on function public.record_privacy_event(text, text, text) to authenticated;

revoke all on function public.privacy_purpose_is_authorized(text) from public, anon;
grant execute on function public.privacy_purpose_is_authorized(text) to authenticated;

comment on table public.privacy_purposes is
  'MVP-003: catálogo versionado de finalidades; estados pending_dpo não autorizam tratamento opcional.';
comment on table public.privacy_consent_events is
  'MVP-003: histórico mínimo por titular; sem perfil, CV, token, prompt ou payload externo.';
comment on function public.privacy_purpose_is_authorized is
  'Gate de servidor: necessárias ativas ou opcionais com versão aprovada e aceite vigente.';
