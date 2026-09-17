-- SEC-STAFF-MFA-02: mutações e leituras privilegiadas staff exigem JWT aal=aal2.
-- Homologação: aplicar na cadeia. Produção: não aplicar (Camada B / PO).
-- Rollback: restaurar policies/RPCs para private.is_admin() / is_curator() /
--   is_moderator() / can_review_curation() (MVP-022) e o corpo anterior de
--   submit_curation_review; drop private.*_aal2() e private.jwt_aal2().

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

  if v_role in ('curator', 'moderator', 'admin') and not private.jwt_aal2() then
    raise exception 'aal2 required';
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

notify pgrst, 'reload schema';
