-- SEC-STAFF-AAL2-PROD-01: promove o pacote SEC-STAFF-MFA-02 para a cadeia prod.
-- Copia o comportamento de held/20260917140000 sem editar esse arquivo.
-- Supersede, no manifesto, policies e RPCs que checavam só o papel.
-- create_admin_pending_job passa a exigir papel admin e jwt aal=aal2.
-- Não executar supabase db push em Production neste PR.
-- Rollback, só com aprovação do Plan: restaurar policies/RPCs para
--   private.is_admin() / is_curator() / is_moderator() / can_review_curation()
--   e o corpo anterior de submit_curation_review e create_admin_pending_job;
--   drop function private.jwt_aal2() e private.*_aal2().

create or replace function private.jwt_aal2()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

create or replace function private.is_admin_aal2()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_admin() and private.jwt_aal2();
$$;

create or replace function private.is_curator_aal2()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_curator() and private.jwt_aal2();
$$;

create or replace function private.is_moderator_aal2()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_moderator() and private.jwt_aal2();
$$;

create or replace function private.can_review_curation_aal2()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.can_review_curation() and private.jwt_aal2();
$$;

revoke all on function private.jwt_aal2() from public;
revoke all on function private.is_admin_aal2() from public;
revoke all on function private.is_curator_aal2() from public;
revoke all on function private.is_moderator_aal2() from public;
revoke all on function private.can_review_curation_aal2() from public;

grant execute on function private.jwt_aal2() to anon, authenticated;
grant execute on function private.is_admin_aal2() to anon, authenticated;
grant execute on function private.is_curator_aal2() to anon, authenticated;
grant execute on function private.is_moderator_aal2() to anon, authenticated;
grant execute on function private.can_review_curation_aal2() to anon, authenticated;

revoke execute on function private.jwt_aal2() from service_role;
revoke execute on function private.is_admin_aal2() from service_role;
revoke execute on function private.is_curator_aal2() from service_role;
revoke execute on function private.is_moderator_aal2() from service_role;
revoke execute on function private.can_review_curation_aal2() from service_role;

comment on function private.jwt_aal2() is
  'SEC-STAFF-MFA-02: claim JWT aal=aal2. Não expor via PostgREST.';
comment on function private.is_admin_aal2() is
  'SEC-STAFF-MFA-02: admin + AAL2. Não expor via PostgREST.';
comment on function private.is_curator_aal2() is
  'SEC-STAFF-MFA-02: curator + AAL2. Não expor via PostgREST.';
comment on function private.is_moderator_aal2() is
  'SEC-STAFF-MFA-02: moderator/admin + AAL2. Não expor via PostgREST.';
comment on function private.can_review_curation_aal2() is
  'SEC-STAFF-MFA-02: staff de curadoria + AAL2. Não expor via PostgREST.';

-- Policies staff (inventário a partir de MVP-022 + MVP-010). Candidato/anon inalterados
-- onde o predicado próprio (auth.uid()) permanece sem AAL2.

drop policy if exists "Perfil: leitura própria" on public.profiles;
create policy "Perfil: leitura própria"
  on public.profiles for select
  using (id = auth.uid() or private.is_admin_aal2());

drop policy if exists "Perfil: atualização própria" on public.profiles;
create policy "Perfil: atualização própria"
  on public.profiles for update
  using (id = auth.uid() or private.is_admin_aal2())
  with check (id = auth.uid() or private.is_admin_aal2());

drop policy if exists "Empresas: gestão administrativa" on public.companies;
create policy "Empresas: gestão administrativa"
  on public.companies for all
  using (private.is_admin_aal2())
  with check (private.is_admin_aal2());

drop policy if exists "Vagas: gestão administrativa" on public.jobs;
drop policy if exists "Vagas: inserção administrativa pending" on public.jobs;
drop policy if exists "Vagas: atualização administrativa pending" on public.jobs;
drop policy if exists "Vagas: exclusão administrativa" on public.jobs;

create policy "Vagas: inserção administrativa pending"
  on public.jobs for insert
  with check (private.is_admin_aal2() and status = 'pending');

create policy "Vagas: atualização administrativa pending"
  on public.jobs for update
  using (private.is_admin_aal2() and status = 'pending')
  with check (private.is_admin_aal2() and status = 'pending');

create policy "Vagas: exclusão administrativa"
  on public.jobs for delete
  using (private.is_admin_aal2());

drop policy if exists "Vagas: leitura fila curadoria" on public.jobs;
create policy "Vagas: leitura fila curadoria"
  on public.jobs for select
  using (private.can_review_curation_aal2());

drop policy if exists "Candidaturas: leitura própria" on public.applications;
create policy "Candidaturas: leitura própria"
  on public.applications for select
  using (candidate_id = auth.uid() or private.is_admin_aal2());

-- S6-01: candidato não faz UPDATE direto (nem status). Retirada só via
-- withdraw_application. Não recriar "Candidaturas: atualização própria".
drop policy if exists "Candidaturas: atualização própria" on public.applications;

drop policy if exists "Candidaturas: inserção administrativa" on public.applications;
create policy "Candidaturas: inserção administrativa"
  on public.applications for insert
  with check (private.is_admin_aal2());

drop policy if exists "Candidaturas: atualização administrativa" on public.applications;
create policy "Candidaturas: atualização administrativa"
  on public.applications for update
  using (private.is_admin_aal2())
  with check (private.is_admin_aal2());

drop policy if exists "Candidaturas: exclusão administrativa" on public.applications;
create policy "Candidaturas: exclusão administrativa"
  on public.applications for delete
  using (private.is_admin_aal2());

drop policy if exists "apply_request_log: admin" on public.apply_request_log;
create policy "apply_request_log: admin"
  on public.apply_request_log for all
  using (private.is_admin_aal2())
  with check (private.is_admin_aal2());

drop policy if exists "Pareceres: leitura interna" on public.job_curation_reviews;
create policy "Pareceres: leitura interna"
  on public.job_curation_reviews for select
  using (private.can_review_curation_aal2());

drop policy if exists "Auditoria: leitura administrativa" on public.privacy_audit_events;
create policy "Auditoria: leitura administrativa"
  on public.privacy_audit_events for select
  using (private.is_admin_aal2());

create or replace function public.submit_curation_review(
  p_job_id uuid,
  p_decision public.curation_decision,
  p_rubric_code text,
  p_internal_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.jobs%rowtype;
  v_round integer;
  v_approve_count integer;
  v_reject_count integer;
  v_total_count integer;
  v_is_tie boolean;
  v_role public.user_role;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  -- AAL2 antes de qualquer leitura: SECURITY DEFINER não revela existência,
  -- status, autoria ou lock da vaga para quem não está em AAL2.
  if not private.can_review_curation_aal2() then
    raise exception 'aal2 required';
  end if;

  if length(trim(coalesce(p_rubric_code, ''))) = 0 then
    raise exception 'rubric_code is required';
  end if;

  select * into v_job
  from public.jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'job not found';
  end if;

  if v_job.status <> 'pending' then
    raise exception 'job is not open for curation';
  end if;

  v_round := v_job.curation_round;

  if v_job.submitted_by is not null and v_uid = v_job.submitted_by then
    raise exception 'cannot review own submission';
  end if;

  if exists (
    select 1
    from public.job_curation_reviews
    where job_id = p_job_id
      and curation_round = v_round
      and reviewer_id = v_uid
  ) then
    raise exception 'already reviewed in this round';
  end if;

  select role into v_role
  from public.profiles
  where id = v_uid;

  if v_role is null then
    raise exception 'profile not found';
  end if;

  select
    count(*) filter (where decision = 'approve'),
    count(*) filter (where decision = 'reject'),
    count(*)
  into v_approve_count, v_reject_count, v_total_count
  from public.job_curation_reviews
  where job_id = p_job_id
    and curation_round = v_round;

  v_is_tie := v_approve_count = 1 and v_reject_count = 1;

  if v_is_tie then
    if v_role not in ('moderator', 'admin') then
      raise exception 'moderation required';
    end if;
  elsif v_total_count >= 2 then
    raise exception 'round already decided';
  elsif v_role not in ('curator', 'moderator', 'admin') then
    raise exception 'not authorized to review';
  end if;

  insert into public.job_curation_reviews (
    job_id,
    curation_round,
    reviewer_id,
    decision,
    rubric_code,
    internal_comment
  ) values (
    p_job_id,
    v_round,
    v_uid,
    p_decision,
    trim(p_rubric_code),
    nullif(trim(coalesce(p_internal_comment, '')), '')
  );

  select
    count(*) filter (where decision = 'approve'),
    count(*) filter (where decision = 'reject')
  into v_approve_count, v_reject_count
  from public.job_curation_reviews
  where job_id = p_job_id
    and curation_round = v_round;

  if v_is_tie then
    if p_decision = 'approve' then
      update public.jobs
      set status = 'approved',
          approved_at = now(),
          rejected_at = null,
          updated_at = now()
      where id = p_job_id;
    else
      update public.jobs
      set status = 'rejected',
          rejected_at = now(),
          approved_at = null,
          updated_at = now()
      where id = p_job_id;
    end if;
  elsif v_approve_count >= 2 then
    update public.jobs
    set status = 'approved',
        approved_at = now(),
        rejected_at = null,
        updated_at = now()
    where id = p_job_id;
  elsif v_reject_count >= 2 then
    update public.jobs
    set status = 'rejected',
        rejected_at = now(),
        approved_at = null,
        updated_at = now()
    where id = p_job_id;
  end if;

  return jsonb_build_object(
    'job_id', p_job_id,
    'status', (select status from public.jobs where id = p_job_id),
    'curation_round', v_round,
    'needs_moderation', exists (
      select 1 from public.jobs_needing_moderation nm where nm.id = p_job_id
    )
  );
end;
$$;

create or replace function public.resubmit_job_for_curation(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not private.is_admin_aal2() then
    raise exception 'admin required';
  end if;

  select * into v_job
  from public.jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'job not found';
  end if;

  if v_job.status <> 'rejected' then
    raise exception 'job is not rejected';
  end if;

  update public.jobs
  set status = 'pending',
      curation_round = curation_round + 1,
      rejected_at = null,
      approved_at = null,
      updated_at = now()
  where id = p_job_id;

  return jsonb_build_object(
    'job_id', p_job_id,
    'status', 'pending',
    'curation_round', v_job.curation_round + 1
  );
end;
$$;

create or replace function public.set_job_curation_priority(
  p_job_id uuid,
  p_priority public.job_priority,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not private.is_admin_aal2() then
    raise exception 'admin required';
  end if;

  if p_priority = 'urgent' and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'priority reason required for urgent';
  end if;

  update public.jobs
  set priority = p_priority,
      priority_reason = case
        when p_priority = 'urgent' then trim(p_reason)
        else null
      end,
      updated_at = now()
  where id = p_job_id;

  if not found then
    raise exception 'job not found';
  end if;

  return jsonb_build_object(
    'job_id', p_job_id,
    'priority', p_priority
  );
end;
$$;

create or replace function public.create_admin_pending_job(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_text text;
  v_company_id uuid;
  v_new_name text;
  v_title text;
  v_description text;
  v_level text;
  v_work_model text;
  v_location text;
  v_country text;
  v_salary_min integer;
  v_salary_max integer;
  v_stack text[] := '{}';
  v_lock_key text;
  v_job public.jobs%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  if not private.is_admin() then
    raise exception 'admin required';
  end if;
  if not private.jwt_aal2() then
    raise exception 'aal2 required';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Título é obrigatório.';
  end if;

  v_title := btrim(coalesce(p_payload->>'title', ''));
  v_description := btrim(coalesce(p_payload->>'description', ''));
  v_level := btrim(coalesce(p_payload->>'level', ''));
  v_work_model := btrim(coalesce(p_payload->>'work_model', ''));
  v_location := nullif(btrim(coalesce(p_payload->>'location', '')), '');
  v_country := nullif(upper(btrim(coalesce(p_payload->>'country_code', ''))), '');
  v_new_name := btrim(coalesce(p_payload->>'new_company_name', ''));
  v_company_text := nullif(btrim(coalesce(p_payload->>'company_id', '')), '');

  if v_title = '' then
    raise exception 'Título é obrigatório.';
  end if;
  if v_description = '' then
    raise exception 'Descrição é obrigatória.';
  end if;
  if v_level not in ('intern', 'junior', 'mid', 'senior') then
    raise exception 'Nível é obrigatório.';
  end if;
  if v_work_model not in ('remote', 'hybrid', 'onsite') then
    raise exception 'Modelo de trabalho é obrigatório.';
  end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception 'País deve ser um código ISO de duas letras.';
  end if;

  if p_payload->>'salary_min' is not null and btrim(p_payload->>'salary_min') <> '' then
    if btrim(p_payload->>'salary_min') !~ '^[0-9]+$' then
      raise exception 'Informe o salário mínimo em centavos inteiros.';
    end if;
    v_salary_min := btrim(p_payload->>'salary_min')::integer;
  end if;
  if p_payload->>'salary_max' is not null and btrim(p_payload->>'salary_max') <> '' then
    if btrim(p_payload->>'salary_max') !~ '^[0-9]+$' then
      raise exception 'Informe o salário máximo em centavos inteiros.';
    end if;
    v_salary_max := btrim(p_payload->>'salary_max')::integer;
  end if;
  if v_salary_min is not null and v_salary_max is not null and v_salary_min > v_salary_max then
    raise exception 'A faixa mínima não pode ser maior que a máxima.';
  end if;

  if jsonb_typeof(p_payload->'stack') = 'array' then
    select coalesce(array_agg(btrim(item)), '{}')
    into v_stack
    from jsonb_array_elements_text(p_payload->'stack') as item
    where btrim(item) <> '';
    v_stack := coalesce(v_stack, '{}');
  end if;

  if v_company_text is null and v_new_name = '' then
    raise exception 'Selecione uma empresa ou informe o nome de uma empresa fictícia.';
  end if;

  if v_company_text is not null
     and v_company_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Empresa não encontrada.';
  end if;

  v_lock_key := coalesce(v_company_text, 'name:' || lower(v_new_name));
  perform pg_advisory_xact_lock(hashtext('create_admin_pending_job'), hashtext(v_lock_key));

  if v_company_text is not null then
    v_company_id := v_company_text::uuid;
    if not exists (select 1 from public.companies where id = v_company_id) then
      raise exception 'Empresa não encontrada.';
    end if;
  else
    select id
    into v_company_id
    from public.companies
    where lower(btrim(name)) = lower(v_new_name)
    order by created_at asc, id asc
    limit 1;

    if not found then
      insert into public.companies (name, description, website)
      values (v_new_name, 'Empresa fictícia de homologação.', 'https://example.invalid')
      returning id into v_company_id;
    end if;
  end if;

  begin
    insert into public.jobs (
      company_id,
      title,
      description,
      stack,
      level,
      work_model,
      location,
      country_code,
      salary_min,
      salary_max,
      requirements,
      status
    ) values (
      v_company_id,
      v_title,
      v_description,
      v_stack,
      v_level,
      v_work_model,
      v_location,
      v_country,
      v_salary_min,
      v_salary_max,
      '{"mandatory": [], "desirable": []}'::jsonb,
      'pending'
    )
    returning * into v_job;
  exception
    when unique_violation then
      if sqlerrm ~* 'jobs_company_normalized_title' then
        raise exception 'Já existe vaga com este título para esta empresa.'
          using errcode = '23505';
      end if;
      raise;
  end;

  return jsonb_build_object(
    'id', v_job.id,
    'title', v_job.title,
    'status', v_job.status
  );
end;
$$;

revoke all on function public.create_admin_pending_job(jsonb) from public, anon;
grant execute on function public.create_admin_pending_job(jsonb) to authenticated;

comment on function public.create_admin_pending_job(jsonb) is
  'SEC-STAFF-AAL2-PROD-01: exige admin e AAL2. TECH-ADMIN-WRITE-ATOMICITY-01: admin cria empresa (se o nome ainda não existe) e vaga pending na mesma transação. Duplicata de lower(btrim(title)) por company_id devolve a mensagem estável e desfaz a empresa criada nessa transação. Sem chave de idempotência.';

notify pgrst, 'reload schema';
