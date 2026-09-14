-- MVP-022 follow-up: least privilege em private.*
-- USAGE/EXECUTE só para anon e authenticated (avaliação de RLS como invocador).
-- postgres é owner (não precisa GRANT). service_role tem BYPASSRLS.
-- Idempotente se 20260914034421 já tiver sido aplicada com grants extras.

revoke usage on schema private from service_role;
revoke execute on function private.is_admin() from service_role;
revoke execute on function private.is_curator() from service_role;
revoke execute on function private.is_moderator() from service_role;
revoke execute on function private.can_review_curation() from service_role;
