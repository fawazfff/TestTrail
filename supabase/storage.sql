-- Run after applying schema.sql. This bucket is public so testers can view screenshots via share links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('test-screenshots', 'test-screenshots', true, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/png','image/jpeg','image/webp'];

-- Anonymous uploads are convenient for a public demo but can be abused. Add authentication/rate limits before production.
drop policy if exists "public demo screenshot uploads" on storage.objects;
create policy "public demo screenshot uploads" on storage.objects for insert to anon with check (bucket_id = 'test-screenshots');
drop policy if exists "public demo screenshot reads" on storage.objects;
create policy "public demo screenshot reads" on storage.objects for select to anon using (bucket_id = 'test-screenshots');
