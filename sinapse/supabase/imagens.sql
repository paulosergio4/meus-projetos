-- Imagens das questões (bucket público para leitura; só administradores enviam e apagam).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('questoes', 'questoes', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin envia imagens de questões" on storage.objects;
create policy "admin envia imagens de questões" on storage.objects
  for insert to authenticated with check (bucket_id = 'questoes' and (select public.is_admin()));

drop policy if exists "admin troca imagens de questões" on storage.objects;
create policy "admin troca imagens de questões" on storage.objects
  for update to authenticated using (bucket_id = 'questoes' and (select public.is_admin())) with check (bucket_id = 'questoes' and (select public.is_admin()));

drop policy if exists "admin apaga imagens de questões" on storage.objects;
create policy "admin apaga imagens de questões" on storage.objects
  for delete to authenticated using (bucket_id = 'questoes' and (select public.is_admin()));

drop policy if exists "admin lista imagens de questões" on storage.objects;
create policy "admin lista imagens de questões" on storage.objects
  for select to authenticated using (bucket_id = 'questoes' and (select public.is_admin()));
