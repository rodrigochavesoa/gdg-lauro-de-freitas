-- UX-PROFILE-AVATAR-01 — Storage avatars (produção / Camada B).
-- Mesmo contrato da homologação: bucket privado + um objeto `{uid}/avatar.jpg`.
-- `pnpm migrations:prod` IGNORA este arquivo enquanto HOMOLOG_ONLY_PATTERN
-- incluir `avatars_single_object`. Só promover após aceite explícito da Camada B.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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
