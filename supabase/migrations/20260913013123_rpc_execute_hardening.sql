-- MVP-021 / SEC-02: restringir EXECUTE das RPCs SECURITY DEFINER na Data API.
-- GRANT TO authenticated não remove o EXECUTE herdado de PUBLIC (default do Postgres).
-- Helpers de policy (is_admin, is_curator, is_moderator, can_review_curation) não são alterados.
-- Rollback: reaplicar GRANT EXECUTE TO PUBLIC, anon nas mesmas assinaturas (não recomendado).

revoke all on function public.submit_curation_review(uuid, public.curation_decision, text, text) from public, anon;
grant execute on function public.submit_curation_review(uuid, public.curation_decision, text, text) to authenticated;

revoke all on function public.resubmit_job_for_curation(uuid) from public, anon;
grant execute on function public.resubmit_job_for_curation(uuid) to authenticated;

revoke all on function public.set_job_curation_priority(uuid, public.job_priority, text) from public, anon;
grant execute on function public.set_job_curation_priority(uuid, public.job_priority, text) to authenticated;

revoke all on function public.jobs_set_submitted_by() from public, anon, authenticated;

revoke all on function public.apply_to_job(uuid) from public, anon;
grant execute on function public.apply_to_job(uuid) to authenticated;

revoke all on function public.withdraw_application(uuid) from public, anon;
grant execute on function public.withdraw_application(uuid) to authenticated;

comment on function public.jobs_set_submitted_by() is
  'BEFORE INSERT em jobs; não é endpoint da Data API. EXECUTE revogado de PUBLIC/anon/authenticated.';

notify pgrst, 'reload schema';
