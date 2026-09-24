-- UX-PROFILE-AVATAR-01 P1 — um objeto por usuário (homologação).
-- Path permitido: {auth.uid()}/avatar.jpg. Não aplicar em produção (Camada B).

drop policy if exists avatars_select_own on storage.objects;
drop policy if exists avatars_insert_own on storage.objects;
drop policy if exists avatars_update_own on storage.objects;
drop policy if exists avatars_delete_own on storage.objects;

create policy avatars_select_own
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and name = (select auth.jwt()->>'sub') || '/avatar.jpg'
);

create policy avatars_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and name = (select auth.jwt()->>'sub') || '/avatar.jpg'
);

create policy avatars_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and name = (select auth.jwt()->>'sub') || '/avatar.jpg'
)
with check (
  bucket_id = 'avatars'
  and name = (select auth.jwt()->>'sub') || '/avatar.jpg'
);

create policy avatars_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and name = (select auth.jwt()->>'sub') || '/avatar.jpg'
);
