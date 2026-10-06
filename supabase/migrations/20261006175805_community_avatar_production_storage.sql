-- PERF-AVATAR-02 — bucket privado para fotos de perfil e proxy da Comunidade.
-- Objetos versionados; leitura de terceiros só via community-avatar autenticada.

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
  and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  and cardinality(storage.foldername(name)) = 1
  and storage.filename(name) ~ '^[A-Za-z0-9_-]{1,80}[.]jpg$'
);

create policy avatars_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  and cardinality(storage.foldername(name)) = 1
  and storage.filename(name) ~ '^[A-Za-z0-9_-]{1,80}[.]jpg$'
);

create policy avatars_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  and cardinality(storage.foldername(name)) = 1
  and storage.filename(name) ~ '^[A-Za-z0-9_-]{1,80}[.]jpg$'
);

notify pgrst, 'reload schema';
