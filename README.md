# Website Resmi SMK Bina Insan Bangsa (SMK BIB)

Situs statis (HTML/CSS/JS) + backend **Supabase** (PostgreSQL, Auth, Storage) + hosting **Vercel**.
Tidak butuh proses build. Semua tombol, form, dan dashboard terhubung ke database.

## Isi proyek

| Path | Fungsi |
|---|---|
| `index.html`, `profil.html`, `program.html`, `guru.html`, `fasilitas.html`, `berita.html`, `galeri.html`, `prestasi.html`, `ppdb.html`, `kontak.html` | 10 menu situs publik |
| `admin/` | Dashboard admin (login aman) |
| `supabase/schema.sql` | Tabel, keamanan RLS, storage, data awal |
| `assets/js/config.js` | **Satu-satunya file yang perlu diisi** (URL + anon key Supabase) |
| `vercel.json` | Header keamanan (CSP, HSTS, dll.) |
| `sitemap.xml`, `robots.txt` | SEO |

## Langkah pemasangan (±20 menit)

### 1. Buat project Supabase
1. Daftar di supabase.com, **New project** (pilih region Singapore).
2. Buka **SQL Editor > New query**, tempel seluruh isi `supabase/schema.sql`, klik **Run**.

### 2. Hubungkan situs
Di Supabase: **Project Settings > API**. Salin **Project URL** dan **anon public key** ke `assets/js/config.js`.
Jangan pernah memakai `service_role key` di situs.

### 3. Buat akun admin
1. Supabase > **Authentication > Users > Add user**: isi email + password, centang *Auto Confirm*.
2. Di SQL Editor jalankan (ganti emailnya):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'email-admin@contoh.com';
   ```
3. Di **Authentication > URL Configuration**, isi *Site URL* dengan alamat situs (agar fitur "Lupa password" bekerja).
4. Matikan pendaftaran publik: **Authentication > Providers > Email > nonaktifkan "Allow new users to sign up"**.

### 4. Publikasikan ke Vercel
1. Unggah folder ini ke repositori GitHub, lalu di vercel.com pilih **Add New > Project** dan impor repositori (Framework: *Other*, tanpa build command, output directory kosong/root).
2. Domain: **Settings > Domains**, tambahkan domain sekolah dan ikuti petunjuk DNS. SSL/HTTPS otomatis.
3. Jika domain bukan `smkbibngamprah.sch.id`, ganti alamat itu di `sitemap.xml`, `robots.txt`, `config.js`, dan tag `canonical`/`og:url` pada setiap halaman HTML.

### 5. Isi konten lewat `alamat-situs/admin/`
Ikuti daftar "Yang perlu dilengkapi" di halaman Ringkasan dashboard.

## Yang HARUS dikonfirmasi sekolah sebelum dipublikasikan

- **Program keahlian** (TKJ, TBSM, BDP) dibuat dalam status *Draf*; aktifkan di dashboard setelah dipastikan masih dibuka. Deskripsinya bersifat umum, sesuaikan dengan kurikulum sekolah.
- **Akreditasi A**: isi masa berlaku di Identitas & Logo.
- **Kata "Keunggulan"** di beranda berasal dari contoh pada brief; ubah/hapus di Profil, Visi & Misi jika tidak sesuai.
- Visi, misi, sejarah, kepala sekolah, guru, fasilitas, dan prestasi sengaja **kosong** (tidak dikarang).
- **PPDB**: formulir baru tampil jika "Buka formulir pendaftaran online" dicentang. Isi jadwal dan biaya hanya setelah dikonfirmasi.

## Keamanan dan cadangan

- Data pendaftar dan pesan: publik hanya bisa **mengisi**, hanya admin yang bisa **membaca** (RLS). Dokumen PPDB disimpan di bucket privat.
- Pustaka `supabase-js` dimuat dari CDN jsDelivr (versi mayor 2). Untuk keamanan maksimal, kunci ke versi tetap dan tambahkan atribut SRI.
- Cadangan: paket Supabase gratis **tidak** memiliki backup otomatis. Gunakan tombol **Ekspor CSV** di Data Pendaftar secara berkala, atau upgrade ke paket Pro (backup harian).
- Foto dikompres otomatis (maks. 1600 px, WebP) saat diunggah.
- Halaman berita/program dirender oleh JavaScript; judul tab diperbarui otomatis, tetapi sitemap hanya memuat halaman utama.
