-- PERF-AVATAR-02 — Storage avatars versionado (produção / Camada B).
-- Mesmo contrato da homologação: bucket privado + `{uid}/{version}.jpg`.
-- `pnpm migrations:prod` IGNORA este arquivo enquanto HOMOLOG_ONLY_PATTERN
-- incluir `avatars_`. Só promover após aceite explícito da Camada B.

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
  and storage.filename(name) ~ '^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$'
);

create policy avatars_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  and cardinality(storage.foldername(name)) = 1
  and storage.filename(name) ~ '^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$'
);

create policy avatars_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  and cardinality(storage.foldername(name)) = 1
  and storage.filename(name) ~ '^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$'
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  and cardinality(storage.foldername(name)) = 1
  and storage.filename(name) ~ '^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$'
);

create policy avatars_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  and cardinality(storage.foldername(name)) = 1
  and storage.filename(name) ~ '^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$'
);
