set statement_timeout = '30s';

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'clinic-profile-photos',
  'clinic-profile-photos',
  false,
  153600,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_photos_public_read on storage.objects;
drop policy if exists profile_photos_authenticated_read on storage.objects;
drop policy if exists profile_photos_authenticated_write on storage.objects;

-- The application service key owns writes and signed previews; browsers get no bucket policy.
