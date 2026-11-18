-- =====================================================================
-- SMK Bina Insan Bangsa (SMK BIB) - Skema database Supabase (PostgreSQL)
-- Jalankan SELURUH isi file ini di Supabase > SQL Editor > New query > Run.
-- Aman dijalankan ulang (idempotent).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Admin
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.admins enable row level security;
drop policy if exists "admin lihat dirinya sendiri" on public.admins;
create policy "admin lihat dirinya sendiri" on public.admins
  for select to authenticated using (user_id = auth.uid());
-- Tidak ada policy insert/update/delete: admin baru hanya bisa ditambah lewat SQL Editor.

-- ---------------------------------------------------------------------
-- 2. Trigger updated_at
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Pengaturan situs (identitas, profil, PPDB) - pasangan key/value JSON
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. Tabel konten
-- ---------------------------------------------------------------------
create table if not exists public.programs (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  code              text not null,
  name              text not null,
  summary           text,
  description       text,
  objectives        text,
  competencies      text,
  learning_materials text,
  careers           text,
  facilities        text,
  activities        text,
  image_url         text,
  sort_order        int  not null default 0,
  is_published      boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.teachers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text not null default 'Guru' check (category in ('Pimpinan','Guru','Tenaga Kependidikan')),
  position     text,
  subject      text,
  photo_url    text,
  sort_order   int  not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.facilities (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  image_url    text,
  sort_order   int  not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.news (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  category     text not null default 'Berita Sekolah',
  summary      text,
  content      text,
  image_url    text,
  published_at date not null default current_date,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.gallery (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  category     text not null default 'Kegiatan Sekolah',
  media_type   text not null default 'foto' check (media_type in ('foto','video')),
  url          text not null,
  program_slug text,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.achievements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  owner_type   text not null default 'Siswa' check (owner_type in ('Siswa','Guru','Sekolah')),
  level        text,
  year         int,
  description  text,
  image_url    text,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. Data pengunjung (hanya bisa DIISI publik, hanya bisa DIBACA admin)
-- ---------------------------------------------------------------------
create table if not exists public.applicants (
  id              uuid primary key,
  reg_code        text not null unique check (char_length(reg_code) between 6 and 20),
  created_at      timestamptz not null default now(),
  full_name       text not null check (char_length(full_name) between 3 and 120),
  nisn            text check (nisn is null or char_length(nisn) <= 20),
  birth_place     text check (birth_place is null or char_length(birth_place) <= 80),
  birth_date      date,
  gender          text check (gender in ('L','P')),
  address         text check (address is null or char_length(address) <= 400),
  previous_school text check (previous_school is null or char_length(previous_school) <= 120),
  program_code    text check (program_code is null or char_length(program_code) <= 40),
  parent_name     text not null check (char_length(parent_name) between 3 and 120),
  parent_phone    text not null check (char_length(parent_phone) between 8 and 20),
  student_phone   text check (student_phone is null or char_length(student_phone) <= 20),
  email           text check (email is null or char_length(email) <= 120),
  documents       jsonb not null default '[]'::jsonb,
  status          text not null default 'baru' check (status in ('baru','diproses','diterima','cadangan','ditolak')),
  notes           text
);

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null check (char_length(name) between 2 and 120),
  email      text check (email is null or char_length(email) <= 120),
  phone      text check (phone is null or char_length(phone) <= 20),
  subject    text check (subject is null or char_length(subject) <= 160),
  message    text not null check (char_length(message) between 5 and 4000),
  is_read    boolean not null default false
);

-- trigger updated_at
do $$
declare t text;
begin
  foreach t in array array['settings','programs','teachers','facilities','news','gallery','achievements']
  loop
    execute format('drop trigger if exists trg_touch on public.%I', t);
    execute format('create trigger trg_touch before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------
alter table public.settings     enable row level security;
alter table public.programs     enable row level security;
alter table public.teachers     enable row level security;
alter table public.facilities   enable row level security;
alter table public.news         enable row level security;
alter table public.gallery      enable row level security;
alter table public.achievements enable row level security;
alter table public.applicants   enable row level security;
alter table public.messages     enable row level security;

-- settings: publik boleh baca, admin boleh ubah
drop policy if exists "settings publik baca" on public.settings;
create policy "settings publik baca" on public.settings for select to anon, authenticated using (true);
drop policy if exists "settings admin kelola" on public.settings;
create policy "settings admin kelola" on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- tabel konten: publik hanya melihat yang is_published; admin melihat & mengelola semua
do $$
declare t text;
begin
  foreach t in array array['programs','teachers','facilities','news','gallery','achievements']
  loop
    execute format('drop policy if exists "publik baca terbit" on public.%I', t);
    execute format('create policy "publik baca terbit" on public.%I for select to anon, authenticated using (is_published or public.is_admin())', t);
    execute format('drop policy if exists "admin kelola" on public.%I', t);
    execute format('create policy "admin kelola" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- applicants: publik hanya boleh INSERT (status awal saja), tidak boleh SELECT
drop policy if exists "publik kirim pendaftaran" on public.applicants;
create policy "publik kirim pendaftaran" on public.applicants for insert to anon, authenticated
  with check (status = 'baru' and notes is null);
drop policy if exists "admin kelola pendaftar" on public.applicants;
create policy "admin kelola pendaftar" on public.applicants for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- messages: publik hanya boleh INSERT
drop policy if exists "publik kirim pesan" on public.messages;
create policy "publik kirim pesan" on public.messages for insert to anon, authenticated
  with check (is_read = false);
drop policy if exists "admin kelola pesan" on public.messages;
create policy "admin kelola pesan" on public.messages for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 7. Storage
--    media     : publik (foto berita, galeri, guru, dll). Hanya admin yang boleh unggah.
--    ppdb-docs : PRIVAT. Calon siswa boleh unggah, hanya admin yang boleh membaca.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media',     'media',     true,  5242880, array['image/jpeg','image/png','image/webp','image/gif']),
  ('ppdb-docs', 'ppdb-docs', false, 2097152, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media admin tulis" on storage.objects;
create policy "media admin tulis" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());
drop policy if exists "media admin ubah" on storage.objects;
create policy "media admin ubah" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin());
drop policy if exists "media admin hapus" on storage.objects;
create policy "media admin hapus" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());

drop policy if exists "ppdb publik unggah" on storage.objects;
create policy "ppdb publik unggah" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'ppdb-docs');
drop policy if exists "ppdb admin baca" on storage.objects;
create policy "ppdb admin baca" on storage.objects for select to authenticated
  using (bucket_id = 'ppdb-docs' and public.is_admin());
drop policy if exists "ppdb admin hapus" on storage.objects;
create policy "ppdb admin hapus" on storage.objects for delete to authenticated
  using (bucket_id = 'ppdb-docs' and public.is_admin());

-- ---------------------------------------------------------------------
-- 8. Data awal. HANYA data yang diberikan pemilik sekolah.
--    Visi, misi, sejarah, kepala sekolah, guru, fasilitas, prestasi sengaja DIKOSONGKAN.
--    Isi lewat dashboard admin.
-- ---------------------------------------------------------------------
insert into public.settings (key, value) values
('identity', jsonb_build_object(
  'school_name', 'SMK Bina Insan Bangsa',
  'short_name', 'SMK BIB',
  'foundation', 'Yayasan Pendidikan Bina Insan Bangsa Ngamprah',
  'npsn', '69733880',
  'status', 'Swasta',
  'accreditation', 'A',
  'accreditation_valid', '',
  'address', 'Jl. Ngamprah No. 1A, Kecamatan Ngamprah, Kabupaten Bandung Barat, Jawa Barat 40552',
  'phone', '(022) 86814566',
  'email', '', 'whatsapp', '',
  'facebook', '', 'instagram', '', 'youtube', '', 'tiktok', '',
  'logo_url', '', 'hero_image', ''
)),
('profile', jsonb_build_object(
  'about', 'SMK Bina Insan Bangsa adalah sekolah menengah kejuruan swasta di bawah naungan Yayasan Pendidikan Bina Insan Bangsa Ngamprah, berlokasi di Kecamatan Ngamprah, Kabupaten Bandung Barat, Jawa Barat.',
  'principal_name', '', 'principal_title', 'Kepala Sekolah', 'principal_photo', '', 'principal_message', '',
  'history', '', 'vision', '', 'mission', '', 'goals', '',
  'org_image', '', 'org_note', '',
  'advantages_text', E'Pembelajaran berbasis praktik | Penguatan kompetensi kejuruan melalui kegiatan praktik.\nPengembangan karakter | Pembentukan sikap disiplin, tanggung jawab, dan etika kerja.\nPraktik Kerja Lapangan (PKL) | Pengalaman belajar langsung di dunia usaha dan dunia industri.\nHubungan dengan dunia usaha dan industri | Keterkaitan pembelajaran dengan kebutuhan dunia kerja.'
)),
('ppdb', jsonb_build_object(
  'registration_open', false,
  'year', '',
  'intro', '',
  'requirements', '',
  'flow', '',
  'schedule', '',
  'fee_info', '',
  'contact_name', '',
  'contact_phone', ''
))
on conflict (key) do nothing;

-- Tiga program keahlian yang tercatat pada profil sekolah.
-- is_published = false: AKTIFKAN lewat dashboard setelah sekolah mengonfirmasi bahwa program masih dibuka.
-- Deskripsi bersifat umum (kompetensi bidang kejuruan), silakan sesuaikan dengan kurikulum sekolah.
insert into public.programs (slug, code, name, summary, description, objectives, competencies, learning_materials, careers, sort_order, is_published) values
('tkj', 'TKJ', 'Teknik Komputer dan Jaringan',
 'Mempelajari perakitan komputer, jaringan, dan administrasi server.',
 '<p>Teknik Komputer dan Jaringan (TKJ) membekali peserta didik dengan kompetensi merakit, memasang, mengonfigurasi, dan memelihara perangkat komputer serta jaringan komputer.</p>',
 '<p>Membekali peserta didik dengan keterampilan teknis di bidang komputer dan jaringan agar siap bekerja, melanjutkan pendidikan, atau berwirausaha.</p>',
 '<ul><li>Perakitan dan perawatan komputer</li><li>Instalasi sistem operasi dan aplikasi</li><li>Jaringan komputer (LAN/WAN) dan pengalamatan IP</li><li>Konfigurasi router dan switch</li><li>Administrasi sistem server</li><li>Dasar keamanan jaringan</li></ul>',
 '<ul><li>Dasar-dasar teknik komputer dan jaringan</li><li>Teknologi jaringan kabel dan nirkabel</li><li>Administrasi infrastruktur jaringan</li><li>Administrasi sistem jaringan</li></ul>',
 '<ul><li>Teknisi komputer</li><li>Teknisi dan administrator jaringan</li><li>IT support / help desk</li><li>Wirausaha di bidang teknologi informasi</li></ul>',
 1, false),
('tbsm', 'TBSM', 'Teknik dan Bisnis Sepeda Motor',
 'Mempelajari servis, perawatan, dan pengelolaan bisnis bengkel sepeda motor.',
 '<p>Teknik dan Bisnis Sepeda Motor (TBSM) membekali peserta didik dengan kompetensi perawatan dan perbaikan sepeda motor serta dasar pengelolaan usaha bengkel.</p>',
 '<p>Membekali peserta didik dengan keterampilan servis sepeda motor dan kemampuan dasar berwirausaha di bidang otomotif.</p>',
 '<ul><li>Pemeliharaan mesin sepeda motor</li><li>Pemeliharaan kelistrikan</li><li>Pemeliharaan sasis dan pemindah tenaga</li><li>Sistem bahan bakar, termasuk injeksi</li><li>Pelayanan servis dan dasar manajemen bengkel</li></ul>',
 '<ul><li>Dasar-dasar teknik otomotif</li><li>Teknik pemeliharaan sepeda motor</li><li>Teknologi sepeda motor</li><li>Kewirausahaan dan bisnis bengkel</li></ul>',
 '<ul><li>Mekanik sepeda motor</li><li>Teknisi bengkel / dealer</li><li>Service advisor</li><li>Wirausaha bengkel sepeda motor</li></ul>',
 2, false),
('bdp', 'BDP', 'Bisnis Daring dan Pemasaran',
 'Mempelajari pemasaran digital, penjualan daring, dan layanan pelanggan.',
 '<p>Bisnis Daring dan Pemasaran (BDP) membekali peserta didik dengan kompetensi pemasaran, penjualan melalui platform digital, dan pelayanan pelanggan.</p>',
 '<p>Membekali peserta didik dengan keterampilan bisnis dan pemasaran digital agar siap bekerja maupun berwirausaha.</p>',
 '<ul><li>Pemasaran digital dan media sosial</li><li>Pengelolaan toko daring / marketplace</li><li>Pembuatan konten promosi</li><li>Komunikasi bisnis dan layanan pelanggan</li><li>Administrasi transaksi bisnis</li></ul>',
 '<ul><li>Dasar-dasar bisnis dan pemasaran</li><li>Komunikasi bisnis</li><li>Pemasaran daring</li><li>Kewirausahaan</li></ul>',
 '<ul><li>Staf pemasaran digital</li><li>Admin toko daring / marketplace</li><li>Content creator</li><li>Customer service</li><li>Wirausaha daring</li></ul>',
 3, false)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- 9. Menambah admin pertama
--    a) Supabase > Authentication > Users > Add user (isi email + password, centang Auto Confirm).
--    b) Jalankan perintah ini (ganti emailnya):
--
--    insert into public.admins (user_id)
--    select id from auth.users where email = 'email-admin@contoh.com';
-- ---------------------------------------------------------------------
