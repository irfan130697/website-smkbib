/* Dashboard admin SMK BIB. Autentikasi + CRUD lewat Supabase; keamanan sebenarnya dijaga oleh RLS di database. */
(function () {
  'use strict';
  const CFG = window.SMKBIB_CONFIG || {};
  const { esc, sanitize, rich, slugify, fmtDate } = window.U;
  const root = document.getElementById('root');
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) {
    root.innerHTML = '<div class="login"><div class="login-card"><h1>Database belum terhubung</h1><p class="sub">Isi <b>SUPABASE_URL</b> dan <b>SUPABASE_ANON_KEY</b> di <code>assets/js/config.js</code>, lalu muat ulang halaman ini. Panduan ada di README.md.</p></div></div>';
    return;
  }
  if (!window.supabase) {
    root.innerHTML = '<div class="login"><div class="login-card"><h1>Pustaka gagal dimuat</h1><p class="sub">Tidak dapat memuat pustaka Supabase dari CDN. Periksa koneksi internet, lalu muat ulang.</p></div></div>';
    return;
  }
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

  const today = () => new Date().toISOString().slice(0, 10);
  const GALLERY_CATS = ['Kegiatan Sekolah', 'Kegiatan Pembelajaran', 'Praktik Jurusan', 'Upacara', 'Ekstrakurikuler', 'Kegiatan Siswa', 'Kegiatan Guru', 'Prestasi', 'Acara Khusus'];
  const NEWS_CATS = ['Berita Sekolah', 'Pengumuman', 'Akademik', 'Kegiatan Siswa', 'Prestasi', 'PPDB'];
  const STATUSES = [['baru', 'Baru'], ['diproses', 'Diproses'], ['diterima', 'Diterima'], ['cadangan', 'Cadangan'], ['ditolak', 'Ditolak']];

  /* ---------- Definisi modul ---------- */
  const F = (k, l, t, o) => Object.assign({ k, l, t: t || 'text' }, o || {});
  const MODULES = [
    { id: 'dashboard', label: 'Ringkasan' },
    { id: 'identity', label: 'Identitas & Logo', type: 'settings', key: 'identity', title: 'Identitas, Kontak & Logo',
      lead: 'Data identitas sekolah, kontak, media sosial, dan logo situs.',
      fields: [F('school_name', 'Nama sekolah', 'text', { req: 1 }), F('short_name', 'Singkatan'), F('foundation', 'Yayasan'), F('npsn', 'NPSN'), F('status', 'Status sekolah'),
        F('accreditation', 'Akreditasi'), F('accreditation_valid', 'Masa berlaku akreditasi', 'text', { help: 'Contoh: 2023–2028 atau nomor SK. Kosongkan jika belum dikonfirmasi.' }),
        F('address', 'Alamat', 'textarea'), F('phone', 'Telepon'), F('email', 'Email', 'email'),
        F('whatsapp', 'Nomor WhatsApp', 'tel', { help: 'Format 08xx atau 628xx. Kosongkan untuk menyembunyikan tombol WhatsApp.' }),
        F('facebook', 'Facebook (URL)', 'url'), F('instagram', 'Instagram (URL)', 'url'), F('youtube', 'YouTube (URL)', 'url'), F('tiktok', 'TikTok (URL)', 'url'),
        F('logo_url', 'Logo situs (opsional)', 'image', { raw: 1, folder: 'logo', help: 'Kosongkan untuk memakai logo resmi bawaan. Jangan mengubah bentuk/warna logo.' }),
        F('hero_image', 'Foto latar beranda (opsional)', 'image', { folder: 'hero', help: 'Foto sekolah/kegiatan, disarankan lebar minimal 1600 px.' })] },
    { id: 'profile', label: 'Profil, Visi & Misi', type: 'settings', key: 'profile', title: 'Profil Sekolah',
      lead: 'Isi hanya informasi yang sudah terverifikasi. Bagian yang kosong tampil sebagai "belum dipublikasikan".',
      fields: [F('about', 'Deskripsi singkat sekolah', 'textarea'), F('principal_name', 'Nama kepala sekolah'), F('principal_title', 'Jabatan'), F('principal_photo', 'Foto kepala sekolah', 'image', { folder: 'tokoh' }),
        F('principal_message', 'Sambutan kepala sekolah', 'richtext'), F('history', 'Sejarah berdirinya sekolah', 'richtext'), F('vision', 'Visi', 'richtext'), F('mission', 'Misi', 'richtext'),
        F('goals', 'Tujuan sekolah', 'richtext'), F('org_image', 'Bagan struktur organisasi (gambar)', 'image', { folder: 'profil' }), F('org_note', 'Keterangan struktur organisasi', 'richtext'),
        F('advantages_text', 'Keunggulan sekolah', 'textarea', { help: 'Satu keunggulan per baris, format: Judul | Deskripsi singkat. Pastikan sesuai kenyataan.' })] },
    { id: 'programs', label: 'Program Keahlian', type: 'table', table: 'programs', title: 'Program Keahlian', order: ['sort_order', 'name'],
      lead: 'Aktifkan "Tampilkan di situs" hanya setelah sekolah memastikan program masih dibuka. Deskripsi bawaan bersifat umum, sesuaikan dengan kurikulum sekolah.',
      cols: [['code', 'Kode'], ['name', 'Nama'], ['sort_order', 'Urutan'], ['is_published', 'Status']],
      def: { is_published: false, sort_order: 0 },
      fields: [F('slug', 'Slug URL', 'text', { req: 1, help: 'Huruf kecil/angka/strip, mis. tkj. Dipakai pada alamat halaman.' }), F('code', 'Kode', 'text', { req: 1 }), F('name', 'Nama program', 'text', { req: 1 }),
        F('summary', 'Ringkasan (1–2 kalimat)', 'textarea'), F('description', 'Deskripsi jurusan', 'richtext'), F('objectives', 'Tujuan pembelajaran', 'richtext'), F('competencies', 'Kompetensi yang dipelajari', 'richtext'),
        F('learning_materials', 'Materi pembelajaran', 'richtext'), F('facilities', 'Fasilitas pendukung', 'richtext'), F('careers', 'Prospek kerja', 'richtext'), F('activities', 'Kegiatan jurusan', 'richtext'),
        F('image_url', 'Foto program', 'image', { folder: 'program' }), F('sort_order', 'Urutan tampil', 'number'), F('is_published', 'Tampilkan di situs', 'bool')] },
    { id: 'teachers', label: 'Guru & Tendik', type: 'table', table: 'teachers', title: 'Guru dan Tenaga Kependidikan', order: ['sort_order', 'name'],
      cols: [['name', 'Nama'], ['category', 'Kategori'], ['position', 'Jabatan'], ['is_published', 'Status']], def: { is_published: true, sort_order: 0, category: 'Guru' },
      fields: [F('name', 'Nama lengkap (beserta gelar)', 'text', { req: 1 }), F('category', 'Kategori', 'select', { opts: ['Pimpinan', 'Guru', 'Tenaga Kependidikan'] }), F('position', 'Jabatan'), F('subject', 'Mata pelajaran / bidang'),
        F('photo_url', 'Foto', 'image', { folder: 'guru' }), F('sort_order', 'Urutan tampil', 'number'), F('is_published', 'Tampilkan di situs', 'bool')] },
    { id: 'facilities', label: 'Fasilitas', type: 'table', table: 'facilities', title: 'Fasilitas', order: ['sort_order', 'name'],
      cols: [['name', 'Nama'], ['sort_order', 'Urutan'], ['is_published', 'Status']], def: { is_published: true, sort_order: 0 },
      fields: [F('name', 'Nama fasilitas', 'text', { req: 1 }), F('description', 'Deskripsi', 'textarea'), F('image_url', 'Foto', 'image', { folder: 'fasilitas' }), F('sort_order', 'Urutan tampil', 'number'), F('is_published', 'Tampilkan di situs', 'bool')] },
    { id: 'news', label: 'Berita', type: 'table', table: 'news', title: 'Berita dan Informasi', order: ['published_at', 'created_at'], desc: true,
      cols: [['title', 'Judul'], ['category', 'Kategori'], ['published_at', 'Tanggal', 'date'], ['is_published', 'Status']], def: { is_published: true, category: 'Berita Sekolah' },
      fields: [F('title', 'Judul', 'text', { req: 1 }), F('category', 'Kategori', 'combo', { opts: NEWS_CATS }), F('published_at', 'Tanggal publikasi', 'date', { req: 1 }), F('summary', 'Ringkasan', 'textarea'),
        F('content', 'Isi berita', 'richtext'), F('image_url', 'Foto utama', 'image', { folder: 'berita' }), F('is_published', 'Terbitkan', 'bool')] },
    { id: 'gallery', label: 'Galeri', type: 'table', table: 'gallery', title: 'Galeri Foto dan Video', order: ['created_at'], desc: true,
      cols: [['title', 'Judul'], ['category', 'Kategori'], ['media_type', 'Jenis'], ['is_published', 'Status']], def: { is_published: true, media_type: 'foto', category: 'Kegiatan Sekolah' },
      fields: [F('title', 'Judul / keterangan', 'text', { req: 1 }), F('category', 'Kategori', 'combo', { opts: GALLERY_CATS }), F('media_type', 'Jenis', 'select', { opts: ['foto', 'video'] }),
        F('url', 'Foto (unggah) atau tautan video', 'image', { req: 1, folder: 'galeri', help: 'Foto: klik Unggah. Video: tempel tautan YouTube (video besar jangan diunggah langsung).' }),
        F('program_slug', 'Tampil di halaman program (opsional)', 'text', { help: 'Isi slug program, mis. tkj, tbsm, bdp, untuk menampilkannya sebagai dokumentasi praktik jurusan.' }), F('is_published', 'Tampilkan di situs', 'bool')] },
    { id: 'achievements', label: 'Prestasi', type: 'table', table: 'achievements', title: 'Prestasi', order: ['year', 'created_at'], desc: true,
      cols: [['title', 'Prestasi'], ['owner_type', 'Untuk'], ['year', 'Tahun'], ['is_published', 'Status']], def: { is_published: true, owner_type: 'Siswa' },
      fields: [F('title', 'Nama prestasi', 'text', { req: 1 }), F('owner_type', 'Diraih oleh', 'select', { opts: ['Siswa', 'Guru', 'Sekolah'] }), F('level', 'Tingkat (kabupaten, provinsi, nasional…)'), F('year', 'Tahun', 'number'),
        F('description', 'Keterangan', 'textarea'), F('image_url', 'Foto', 'image', { folder: 'prestasi' }), F('is_published', 'Tampilkan di situs', 'bool')] },
    { id: 'ppdb', label: 'Informasi PPDB', type: 'settings', key: 'ppdb', title: 'Informasi PPDB',
      lead: 'Isi jadwal dan biaya HANYA setelah dikonfirmasi sekolah. Formulir online baru tampil jika pendaftaran dibuka.',
      fields: [F('registration_open', 'Buka formulir pendaftaran online', 'bool'), F('year', 'Tahun ajaran (mis. 2027/2028)'), F('intro', 'Informasi pendaftaran', 'richtext'), F('requirements', 'Persyaratan calon siswa', 'richtext'),
        F('flow', 'Alur pendaftaran', 'richtext'), F('schedule', 'Jadwal pendaftaran', 'richtext'), F('fee_info', 'Biaya dan informasi lain', 'richtext'), F('contact_name', 'Nama panitia / kontak'), F('contact_phone', 'Nomor HP/WA panitia', 'tel')] },
    { id: 'applicants', label: 'Data Pendaftar', type: 'applicants' },
    { id: 'messages', label: 'Pesan Pengunjung', type: 'messages' }
  ];

  /* ---------- Util UI ---------- */
  let toastT;
  function toast(t, err) {
    $$('.toast').forEach((x) => x.remove());
    const d = document.createElement('div'); d.className = 'toast' + (err ? ' err' : ''); d.textContent = t; d.setAttribute('role', 'status');
    document.body.appendChild(d); clearTimeout(toastT); toastT = setTimeout(() => d.remove(), 3600);
  }
  const errText = (e) => (e && e.message) || 'Terjadi kesalahan.';
  const view = () => $('#view');
  const download = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  function toCSV(rows, cols) {
    const q = (v) => '"' + String(v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : v).replace(/"/g, '""') + '"';
    return '﻿' + [cols.map((c) => q(c[1])).join(',')].concat(rows.map((r) => cols.map((c) => q(r[c[0]])).join(','))).join('\r\n');
  }

  /* ---------- Login ---------- */
  let session = null;
  function loginView(note) {
    root.innerHTML =
      '<div class="login"><div class="login-card"><img src="../assets/img/logo-180.png" alt="Logo"><h1>Dashboard Admin</h1><p class="sub">SMK Bina Insan Bangsa</p>' +
      (note ? '<div class="msg err" role="alert">' + esc(note) + '</div>' : '') +
      '<form class="f" id="lf"><label>Email<input type="email" name="email" required autocomplete="username"></label><label>Password<input type="password" name="password" required autocomplete="current-password"></label>' +
      '<button class="btn" type="submit" id="lb">Masuk</button><button class="btn sec" type="button" id="forgot">Lupa password</button></form></div></div>';
    $('#lf').addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = $('#lb'); b.disabled = true; b.textContent = 'Masuk…';
      const fd = new FormData(e.target);
      const { error } = await sb.auth.signInWithPassword({ email: String(fd.get('email')).trim(), password: String(fd.get('password')) });
      if (error) { loginView('Email atau password salah.'); return; }
      start();
    });
    $('#forgot').addEventListener('click', async () => {
      const email = ($('#lf input[name=email]').value || '').trim();
      if (!email) return toast('Isi email Anda terlebih dahulu.', true);
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      toast(error ? errText(error) : 'Jika email terdaftar, tautan reset password telah dikirim.', !!error);
    });
  }
  function recoveryView() {
    root.innerHTML = '<div class="login"><div class="login-card"><h1>Buat password baru</h1><p class="sub">Masukkan password baru Anda (minimal 8 karakter).</p><form class="f" id="rf"><label>Password baru<input type="password" name="p" minlength="8" required autocomplete="new-password"></label><button class="btn" type="submit">Simpan password</button></form></div></div>';
    $('#rf').addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await sb.auth.updateUser({ password: e.target.p.value });
      if (error) return toast(errText(error), true);
      recovering = false; toast('Password diperbarui.'); start();
    });
  }
  let recovering = false;
  sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') { recovering = true; recoveryView(); } });

  /* ---------- Kerangka ---------- */
  async function start() {
    const { data } = await sb.auth.getSession();
    session = data.session;
    if (recovering) return recoveryView();
    if (!session) return loginView();
    const { data: adm, error } = await sb.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
    if (error || !adm) { await sb.auth.signOut(); return loginView('Akun ini belum terdaftar sebagai admin. Hubungi pengelola database.'); }
    root.innerHTML =
      '<div class="app"><aside class="side"><div class="who"><img src="../assets/img/logo-180.png" alt=""><div>SMK BIB<small>Dashboard admin</small></div></div><nav id="nav" aria-label="Menu admin">' +
      MODULES.map((m) => '<button data-m="' + m.id + '">' + esc(m.label) + '</button>').join('') +
      '</nav><hr><nav><button id="pw">Ganti password</button><button id="out">Keluar</button></nav><div class="foot">' + esc(session.user.email) + '<br><a href="../index.html" style="color:#9fd3f0" target="_blank" rel="noopener">Lihat situs ↗</a></div></aside><main class="content" id="view" tabindex="-1"></main></div>';
    $('#nav').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) open(b.dataset.m); });
    $('#out').addEventListener('click', async () => { await sb.auth.signOut(); loginView(); });
    $('#pw').addEventListener('click', passwordView);
    open((location.hash || '').replace('#', '') || 'dashboard');
  }
  function open(id) {
    const m = MODULES.find((x) => x.id === id) || MODULES[0];
    location.hash = m.id;
    $$('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.m === m.id));
    view().onclick = null;
    view().innerHTML = '<p>Memuat…</p>';
    ({ dashboard, settings: settingsView, table: tableView, applicants: applicantsView, messages: messagesView })[m.type || 'dashboard'](m);
    window.scrollTo(0, 0);
  }
  function passwordView() {
    $$('#nav button').forEach((b) => b.classList.remove('on'));
    view().innerHTML = '<h1>Ganti Password</h1><div class="card" style="max-width:460px"><form class="f" id="pf"><label>Password baru (minimal 8 karakter)<input type="password" name="p" minlength="8" required autocomplete="new-password"></label><button class="btn" type="submit">Simpan</button></form></div>';
    $('#pf').addEventListener('submit', async (e) => { e.preventDefault(); const { error } = await sb.auth.updateUser({ password: e.target.p.value }); toast(error ? errText(error) : 'Password diperbarui.', !!error); if (!error) e.target.reset(); });
  }

  /* ---------- Ringkasan ---------- */
  async function dashboard() {
    const cnt = async (t, f) => { let q = sb.from(t).select('*', { count: 'exact', head: true }); if (f) q = f(q); const r = await q; return r.error ? '–' : r.count; };
    const [nNews, nApp, nMsg, nProg, nProgAll, prof, ppdb] = await Promise.all([
      cnt('news'), cnt('applicants', (q) => q.eq('status', 'baru')), cnt('messages', (q) => q.eq('is_read', false)),
      cnt('programs', (q) => q.eq('is_published', true)), cnt('programs'),
      sb.from('settings').select('value').eq('key', 'profile').maybeSingle(), sb.from('settings').select('value').eq('key', 'ppdb').maybeSingle()
    ]);
    const pv = (prof.data && prof.data.value) || {}, pp = (ppdb.data && ppdb.data.value) || {};
    const todo = [];
    if (nProgAll > 0 && nProg === 0) todo.push('Konfirmasi program keahlian lalu aktifkan di menu <b>Program Keahlian</b> (saat ini belum ada yang tampil di situs).');
    [['principal_name', 'nama kepala sekolah'], ['principal_message', 'sambutan kepala sekolah'], ['history', 'sejarah sekolah'], ['vision', 'visi'], ['mission', 'misi'], ['goals', 'tujuan sekolah']]
      .forEach((x) => { if (!String(pv[x[0]] || '').trim()) todo.push('Lengkapi <b>' + x[1] + '</b> di menu Profil, Visi & Misi.'); });
    if (!pp.registration_open) todo.push('Formulir PPDB masih <b>ditutup</b>. Isi informasi PPDB lalu buka pendaftaran saat siap.');
    view().innerHTML = '<h1>Ringkasan</h1><p class="lead">Selamat datang di dashboard SMK Bina Insan Bangsa.</p>' +
      '<div class="stats"><div class="stat"><b>' + nApp + '</b><span>Pendaftar baru</span></div><div class="stat"><b>' + nMsg + '</b><span>Pesan belum dibaca</span></div><div class="stat"><b>' + nNews + '</b><span>Total berita</span></div><div class="stat"><b>' + nProg + '</b><span>Program tampil di situs</span></div></div>' +
      '<div class="card"><h2 style="margin-top:0;font-size:1.1rem">Yang perlu dilengkapi</h2>' + (todo.length ? '<ul class="todo">' + todo.map((t) => '<li>' + t + '</li>').join('') + '</ul>' : '<p style="margin:0">Semua data utama sudah terisi. 🎉</p>') + '</div>';
  }

  /* ---------- Form generik ---------- */
  function fieldHtml(f, val) {
    const id = 'f_' + f.k, h = f.help ? '<span class="help">' + esc(f.help) + '</span>' : '', rq = f.req ? ' *' : '';
    const v = val == null ? '' : val;
    switch (f.t) {
      case 'textarea': return '<label>' + esc(f.l) + rq + '<textarea data-k="' + f.k + '">' + esc(v) + '</textarea>' + h + '</label>';
      case 'richtext':
        return '<div class="lbl">' + esc(f.l) + rq + '<div class="rte"><div class="tb">' +
          [['bold', 'B'], ['italic', 'I'], ['h2', 'Judul'], ['h3', 'Subjudul'], ['ul', '• Daftar'], ['ol', '1. Daftar'], ['link', 'Tautan'], ['clear', 'Bersihkan']].map((b) => '<button type="button" data-cmd="' + b[0] + '">' + b[1] + '</button>').join('') +
          '</div><div class="ed" contenteditable="true" role="textbox" aria-multiline="true" aria-label="' + esc(f.l) + '" data-k="' + f.k + '" data-rich="1">' + (v ? rich(v) : '') + '</div></div>' + h + '</div>';
      case 'select': return '<label>' + esc(f.l) + rq + '<select data-k="' + f.k + '">' + f.opts.map((o) => '<option' + (String(v) === o ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>' + h + '</label>';
      case 'combo': return '<label>' + esc(f.l) + rq + '<input type="text" list="dl_' + f.k + '" data-k="' + f.k + '" value="' + esc(v) + '"><datalist id="dl_' + f.k + '">' + f.opts.map((o) => '<option value="' + esc(o) + '">').join('') + '</datalist>' + h + '</label>';
      case 'bool': return '<label class="chk"><input type="checkbox" data-k="' + f.k + '"' + (v === true ? ' checked' : '') + '> ' + esc(f.l) + '</label>' + h;
      case 'image':
        return '<div class="lbl">' + esc(f.l) + rq + '<div class="imgf"><div class="row"><input type="text" data-k="' + f.k + '" value="' + esc(v) + '" placeholder="https://… atau klik Unggah" inputmode="url"><button type="button" class="btn sec sm" data-up="' + f.k + '">Unggah</button><button type="button" class="btn danger sm" data-clr="' + f.k + '">Hapus</button><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-file="' + f.k + '"></div><img data-prev="' + f.k + '" alt="" ' + (/^https?:/i.test(v) ? 'src="' + esc(v) + '"' : 'hidden') + '></div>' + h + '</div>';
      default: return '<label>' + esc(f.l) + rq + '<input type="' + (f.t === 'number' ? 'number' : f.t) + '" data-k="' + f.k + '" value="' + esc(v) + '">' + h + '</label>';
    }
  }
  function formHtml(fields, data) {
    return fields.map((f) => fieldHtml(f, data[f.k])).join('');
  }
  async function resizeImage(file, raw) {
    if (raw || file.type === 'image/gif' || !window.createImageBitmap) return file;
    try {
      const bmp = await createImageBitmap(file), r = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((res) => c.toBlob(res, 'image/webp', 0.85));
      return blob ? new File([blob], 'img.webp', { type: 'image/webp' }) : file;
    } catch (e) { return file; }
  }
  function wireForm(scope, fields) {
    const find = (k) => scope.querySelector('[data-k="' + k + '"]');
    scope.addEventListener('mousedown', (e) => { if (e.target.closest('[data-cmd]')) e.preventDefault(); });
    scope.addEventListener('click', (e) => {
      const c = e.target.closest('[data-cmd]');
      if (c) {
        const ed = c.closest('.rte').querySelector('.ed'); ed.focus();
        const cmd = c.dataset.cmd;
        if (cmd === 'bold' || cmd === 'italic') document.execCommand(cmd);
        else if (cmd === 'h2' || cmd === 'h3') document.execCommand('formatBlock', false, cmd.toUpperCase());
        else if (cmd === 'ul') document.execCommand('insertUnorderedList');
        else if (cmd === 'ol') document.execCommand('insertOrderedList');
        else if (cmd === 'clear') { document.execCommand('removeFormat'); document.execCommand('formatBlock', false, 'P'); }
        else if (cmd === 'link') { const u = prompt('Alamat tautan (https://…, mailto:, atau tel:)'); if (u && /^(https?:|mailto:|tel:)/i.test(u.trim())) document.execCommand('createLink', false, u.trim()); else if (u) toast('Tautan tidak valid.', true); }
        return;
      }
      const up = e.target.closest('[data-up]'); if (up) { scope.querySelector('[data-file="' + up.dataset.up + '"]').click(); return; }
      const cl = e.target.closest('[data-clr]'); if (cl) { const i = find(cl.dataset.clr); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    scope.addEventListener('paste', (e) => { if (!e.target.closest('.ed')) return; e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); });
    scope.addEventListener('input', (e) => {
      const i = e.target.closest('input[data-k]'); if (!i) return;
      const p = scope.querySelector('[data-prev="' + i.dataset.k + '"]');
      if (p) { if (/^https?:/i.test(i.value.trim())) { p.src = i.value.trim(); p.hidden = false; } else p.hidden = true; }
    });
    scope.addEventListener('change', async (e) => {
      const fi = e.target.closest('input[data-file]'); if (!fi || !fi.files[0]) return;
      const key = fi.dataset.file, def = fields.find((x) => x.k === key), file = fi.files[0];
      toast('Mengunggah…');
      try {
        const out = await resizeImage(file, def && def.raw);
        if (out.size > 5242880) throw new Error('Ukuran gambar maksimal 5 MB.');
        const ext = (out.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg'), rnd = Math.random().toString(36).slice(2, 8);
        const path = ((def && def.folder) || 'umum') + '/' + Date.now() + '-' + rnd + '.' + ext;
        const up = await sb.storage.from('media').upload(path, out, { contentType: out.type, upsert: false });
        if (up.error) throw up.error;
        const url = sb.storage.from('media').getPublicUrl(path).data.publicUrl;
        const i = find(key); i.value = url; i.dispatchEvent(new Event('input', { bubbles: true }));
        toast('Foto terunggah.');
      } catch (err) { toast('Gagal mengunggah: ' + errText(err), true); }
      fi.value = '';
    });
  }
  function readForm(scope, fields, emptyAsNull) {
    const o = {};
    fields.forEach((f) => {
      const el = scope.querySelector('[data-k="' + f.k + '"]'); let v;
      if (f.t === 'bool') v = el.checked;
      else if (f.t === 'richtext') { const t = (el.textContent || '').trim(); v = !t && !el.querySelector('img') ? '' : sanitize(el.innerHTML); }
      else if (f.t === 'number') v = el.value === '' ? null : Number(el.value);
      else v = el.value.trim();
      if (emptyAsNull && v === '' ) v = null;
      o[f.k] = v;
    });
    return o;
  }
  const missing = (fields, o) => fields.find((f) => f.req && (o[f.k] == null || o[f.k] === ''));

  /* ---------- Pengaturan (key/value) ---------- */
  async function settingsView(m) {
    const { data, error } = await sb.from('settings').select('value').eq('key', m.key).maybeSingle();
    if (error) { view().innerHTML = '<div class="msg err">Gagal memuat: ' + esc(errText(error)) + '</div>'; return; }
    const cur = (data && data.value) || {};
    view().innerHTML = '<h1>' + esc(m.title) + '</h1><p class="lead">' + esc(m.lead || '') + '</p><div class="card"><form class="f" id="sf">' + formHtml(m.fields, cur) + '<div><button class="btn" type="submit" id="sv">Simpan perubahan</button></div></form></div>';
    const form = $('#sf'); wireForm(form, m.fields);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = readForm(form, m.fields, false), bad = missing(m.fields, val);
      if (bad) return toast('Kolom "' + bad.l + '" wajib diisi.', true);
      const btn = $('#sv'); btn.disabled = true;
      const { error: er } = await sb.from('settings').upsert({ key: m.key, value: Object.assign({}, cur, val) }, { onConflict: 'key' });
      btn.disabled = false;
      if (er) return toast('Gagal menyimpan: ' + errText(er), true);
      Object.assign(cur, val); toast('Perubahan disimpan. Situs publik langsung diperbarui.');
    });
  }

  /* ---------- Tabel konten (CRUD) ---------- */
  async function tableView(m) {
    let q = sb.from(m.table).select('*');
    m.order.forEach((c, i) => { q = q.order(c, { ascending: !(m.desc && i === 0), nullsFirst: false }); });
    const { data, error } = await q.limit(500);
    if (error) { view().innerHTML = '<div class="msg err">Gagal memuat: ' + esc(errText(error)) + '</div>'; return; }
    const cell = (r, c) => {
      const v = r[c[0]];
      if (c[0] === 'is_published') return v ? '<span class="pill">Tampil</span>' : '<span class="pill draft">Draf</span>';
      if (c[2] === 'date') return esc(fmtDate(v));
      return esc(v == null ? '' : v);
    };
    view().innerHTML = '<div class="bar"><div><h1>' + esc(m.title) + '</h1>' + (m.lead ? '<p class="lead" style="margin:0">' + esc(m.lead) + '</p>' : '') + '</div><button class="btn" id="add">+ Tambah</button></div>' +
      (data.length ? '<div class="table-wrap"><table><thead><tr>' + m.cols.map((c) => '<th>' + esc(c[1]) + '</th>').join('') + '<th></th></tr></thead><tbody>' +
        data.map((r) => '<tr>' + m.cols.map((c) => '<td>' + cell(r, c) + '</td>').join('') + '<td class="act"><button class="btn sec sm" data-e="' + r.id + '">Ubah</button> <button class="btn danger sm" data-d="' + r.id + '">Hapus</button></td></tr>').join('') + '</tbody></table></div>'
        : '<div class="empty">Belum ada data. Klik <b>+ Tambah</b> untuk memulai.</div>');
    $('#add').addEventListener('click', () => editRow(m, null));
    view().onclick = async (e) => {
      const eb = e.target.closest('[data-e]'), db = e.target.closest('[data-d]');
      if (eb) editRow(m, data.find((r) => r.id === eb.dataset.e));
      if (db) {
        if (!confirm('Hapus data ini? Tindakan tidak dapat dibatalkan.')) return;
        const { error: er } = await sb.from(m.table).delete().eq('id', db.dataset.d);
        if (er) return toast('Gagal menghapus: ' + errText(er), true);
        toast('Data dihapus.'); tableView(m);
      }
    };
  }
  function editRow(m, row) {
    const data = row ? Object.assign({}, row) : Object.assign({}, m.def || {});
    if (!row && m.fields.some((f) => f.k === 'published_at')) data.published_at = today();
    view().innerHTML = '<div class="bar"><h1>' + (row ? 'Ubah' : 'Tambah') + ' · ' + esc(m.title) + '</h1><button class="btn sec" id="back">← Kembali</button></div><div class="card"><div id="fmsg"></div><form class="f" id="ef">' + formHtml(m.fields, data) + '<div><button class="btn" type="submit" id="sv">Simpan</button></div></form></div>';
    const form = $('#ef'); wireForm(form, m.fields);
    $('#back').addEventListener('click', () => open(m.id));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = readForm(form, m.fields, true);
      if (m.table === 'programs') {
        if (!val.slug && val.name) val.slug = slugify(val.name);
        if (val.slug && !/^[a-z0-9-]{2,40}$/.test(val.slug)) return toast('Slug hanya boleh huruf kecil, angka, dan strip (2–40 karakter).', true);
        if (val.sort_order == null) val.sort_order = 0;
      }
      if (val.sort_order === null && 'sort_order' in val) val.sort_order = 0;
      const bad = missing(m.fields, val);
      if (bad) return toast('Kolom "' + bad.l + '" wajib diisi.', true);
      if (m.table === 'gallery' && val.media_type === 'video' && !/^https?:\/\//i.test(val.url)) return toast('Tautan video harus diawali https://', true);
      const btn = $('#sv'); btn.disabled = true;
      const r = row ? await sb.from(m.table).update(val).eq('id', row.id) : await sb.from(m.table).insert(val);
      btn.disabled = false;
      if (r.error) return toast('Gagal menyimpan: ' + (r.error.code === '23505' ? 'slug sudah dipakai.' : errText(r.error)), true);
      toast('Tersimpan.'); open(m.id);
    });
  }

  /* ---------- Data pendaftar ---------- */
  const APP_COLS = [['reg_code', 'No. Pendaftaran'], ['created_at', 'Waktu daftar'], ['full_name', 'Nama'], ['nisn', 'NISN'], ['gender', 'JK'], ['birth_place', 'Tempat lahir'], ['birth_date', 'Tanggal lahir'], ['address', 'Alamat'], ['previous_school', 'Asal sekolah'], ['program_code', 'Program'], ['parent_name', 'Orang tua/wali'], ['parent_phone', 'HP orang tua'], ['student_phone', 'HP siswa'], ['email', 'Email'], ['status', 'Status'], ['notes', 'Catatan']];
  async function applicantsView() {
    const { data, error } = await sb.from('applicants').select('*').order('created_at', { ascending: false }).limit(2000);
    if (error) { view().innerHTML = '<div class="msg err">Gagal memuat: ' + esc(errText(error)) + '</div>'; return; }
    let st = '', q = '';
    const fil = () => data.filter((r) => (!st || r.status === st) && (!q || (r.full_name + ' ' + r.reg_code + ' ' + (r.parent_name || '') + ' ' + (r.previous_school || '')).toLowerCase().includes(q)));
    view().innerHTML = '<h1>Data Pendaftar PPDB</h1><p class="lead">Data bersifat rahasia dan hanya dapat dilihat admin. Ekspor CSV secara berkala sebagai cadangan.</p>' +
      '<div class="bar"><div class="grow"><input class="search" id="q" type="search" placeholder="Cari nama / nomor…" style="width:240px;padding:9px 12px;border:1px solid #c8d7e2;border-radius:10px"><select id="st" style="padding:9px 12px;border:1px solid #c8d7e2;border-radius:10px"><option value="">Semua status</option>' + STATUSES.map((s) => '<option value="' + s[0] + '">' + s[1] + '</option>').join('') + '</select><span id="cnt"></span></div><button class="btn sec" id="csv">Ekspor CSV</button></div><div id="tb"></div>';
    const draw = () => {
      const L = fil(); $('#cnt').textContent = L.length + ' pendaftar';
      $('#tb').innerHTML = L.length ? '<div class="table-wrap"><table><thead><tr><th>No.</th><th>Tanggal</th><th>Nama</th><th>Program</th><th>Status</th><th></th></tr></thead><tbody>' +
        L.map((r) => '<tr><td>' + esc(r.reg_code) + '</td><td>' + esc(fmtDate(r.created_at)) + '</td><td>' + esc(r.full_name) + '</td><td>' + esc(r.program_code || '') + '</td><td><select data-s="' + r.id + '">' + STATUSES.map((s) => '<option value="' + s[0] + '"' + (r.status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>').join('') + '</select></td><td class="act"><button class="btn sec sm" data-v="' + r.id + '">Detail</button></td></tr>').join('') + '</tbody></table></div>'
        : '<div class="empty">Belum ada pendaftar yang cocok.</div>';
    };
    draw();
    $('#q').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
    $('#st').addEventListener('change', (e) => { st = e.target.value; draw(); });
    $('#csv').addEventListener('click', () => download('pendaftar-ppdb-' + today() + '.csv', toCSV(fil(), APP_COLS), 'text/csv;charset=utf-8'));
    $('#tb').addEventListener('change', async (e) => {
      const s = e.target.closest('select[data-s]'); if (!s) return;
      const { error: er } = await sb.from('applicants').update({ status: s.value }).eq('id', s.dataset.s);
      if (er) return toast('Gagal memperbarui: ' + errText(er), true);
      data.find((r) => r.id === s.dataset.s).status = s.value; toast('Status diperbarui.');
    });
    $('#tb').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) applicantModal(data.find((r) => r.id === b.dataset.v), () => open('applicants')); });
  }
  function applicantModal(r, done) {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    const rows = APP_COLS.filter((c) => c[0] !== 'notes').map((c) => '<dt>' + esc(c[1]) + '</dt><dd>' + esc(c[0] === 'created_at' ? new Date(r.created_at).toLocaleString('id-ID') : c[0] === 'birth_date' ? fmtDate(r.birth_date) : c[0] === 'gender' ? (r.gender === 'L' ? 'Laki-laki' : r.gender === 'P' ? 'Perempuan' : '') : r[c[0]] || '-') + '</dd>').join('');
    const docs = Array.isArray(r.documents) ? r.documents : [];
    bg.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-label="Detail pendaftar"><div class="bar"><h2 style="margin:0">' + esc(r.full_name) + '</h2><button class="btn sec sm" data-x>Tutup</button></div><dl class="kv">' + rows + '</dl>' +
      '<h3>Dokumen</h3>' + (docs.length ? docs.map((d, i) => '<p style="margin:4px 0"><button class="btn sec sm" data-doc="' + i + '">Buka ' + esc(d.label) + '</button> <small>' + esc(d.name || '') + '</small></p>').join('') : '<p style="color:#5b6f80">Tidak ada dokumen diunggah.</p>') +
      '<h3>Catatan admin</h3><textarea id="nt" style="width:100%;min-height:80px;padding:10px;border:1px solid #c8d7e2;border-radius:10px;font:inherit">' + esc(r.notes || '') + '</textarea>' +
      '<p style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" data-save>Simpan catatan</button>' + (window.U.waNumber(r.parent_phone) ? '<a class="btn sec" target="_blank" rel="noopener noreferrer" href="https://wa.me/' + esc(window.U.waNumber(r.parent_phone)) + '">WhatsApp orang tua</a>' : '') + '<button class="btn danger" data-del style="margin-left:auto">Hapus pendaftar</button></p></div>';
    document.body.appendChild(bg);
    const close = () => { bg.remove(); document.removeEventListener('keydown', esc_); };
    const esc_ = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc_);
    bg.addEventListener('click', async (e) => {
      if (e.target === bg || e.target.closest('[data-x]')) return close();
      const d = e.target.closest('[data-doc]');
      if (d) {
        const doc = docs[+d.dataset.doc];
        const { data, error } = await sb.storage.from('ppdb-docs').createSignedUrl(doc.path, 300);
        if (error) return toast('Gagal membuka dokumen: ' + errText(error), true);
        window.open(data.signedUrl, '_blank', 'noopener');
      }
      if (e.target.closest('[data-save]')) {
        const { error } = await sb.from('applicants').update({ notes: $('#nt', bg).value.trim() || null }).eq('id', r.id);
        toast(error ? errText(error) : 'Catatan disimpan.', !!error); if (!error) r.notes = $('#nt', bg).value;
      }
      if (e.target.closest('[data-del]')) {
        if (!confirm('Hapus pendaftar ini beserta dokumennya? Tidak dapat dibatalkan.')) return;
        if (docs.length) await sb.storage.from('ppdb-docs').remove(docs.map((x) => x.path));
        const { error } = await sb.from('applicants').delete().eq('id', r.id);
        if (error) return toast('Gagal menghapus: ' + errText(error), true);
        close(); toast('Pendaftar dihapus.'); done();
      }
    });
  }

  /* ---------- Pesan pengunjung ---------- */
  async function messagesView() {
    const { data, error } = await sb.from('messages').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) { view().innerHTML = '<div class="msg err">Gagal memuat: ' + esc(errText(error)) + '</div>'; return; }
    view().innerHTML = '<div class="bar"><div><h1>Pesan Pengunjung</h1><p class="lead" style="margin:0">Pesan dari formulir halaman Kontak.</p></div><button class="btn sec" id="csv">Ekspor CSV</button></div>' +
      (data.length ? '<div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Nama</th><th>Subjek</th><th></th></tr></thead><tbody>' +
        data.map((r) => '<tr class="' + (r.is_read ? '' : 'unread') + '"><td>' + esc(new Date(r.created_at).toLocaleString('id-ID')) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.subject || '(tanpa subjek)') + '</td><td class="act"><button class="btn sec sm" data-o="' + r.id + '">Buka</button></td></tr>').join('') + '</tbody></table></div>'
        : '<div class="empty">Belum ada pesan masuk.</div>');
    const csv = $('#csv'); csv.addEventListener('click', () => download('pesan-' + today() + '.csv', toCSV(data, [['created_at', 'Waktu'], ['name', 'Nama'], ['email', 'Email'], ['phone', 'HP'], ['subject', 'Subjek'], ['message', 'Pesan']]), 'text/csv;charset=utf-8'));
    view().onclick = (e) => {
      const b = e.target.closest('[data-o]'); if (!b) return;
      const r = data.find((x) => x.id === b.dataset.o);
      const bg = document.createElement('div'); bg.className = 'modal-bg';
      const wa = window.U.waNumber(r.phone);
      bg.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-label="Pesan"><div class="bar"><h2 style="margin:0">' + esc(r.subject || 'Pesan dari ' + r.name) + '</h2><button class="btn sec sm" data-x>Tutup</button></div>' +
        '<dl class="kv"><dt>Dari</dt><dd>' + esc(r.name) + '</dd><dt>Email</dt><dd>' + esc(r.email || '-') + '</dd><dt>HP</dt><dd>' + esc(r.phone || '-') + '</dd><dt>Waktu</dt><dd>' + esc(new Date(r.created_at).toLocaleString('id-ID')) + '</dd></dl>' +
        '<p style="white-space:pre-wrap;background:#f3f7fa;padding:14px;border-radius:12px">' + esc(r.message) + '</p>' +
        '<p style="display:flex;gap:10px;flex-wrap:wrap">' + (r.email ? '<a class="btn" href="mailto:' + esc(r.email) + '">Balas via email</a>' : '') + (wa ? '<a class="btn sec" target="_blank" rel="noopener noreferrer" href="https://wa.me/' + wa + '">WhatsApp</a>' : '') +
        '<button class="btn sec" data-read>' + (r.is_read ? 'Tandai belum dibaca' : 'Tandai sudah dibaca') + '</button><button class="btn danger" data-del style="margin-left:auto">Hapus</button></p></div>';
      document.body.appendChild(bg);
      if (!r.is_read) sb.from('messages').update({ is_read: true }).eq('id', r.id).then(() => { r.is_read = true; });
      const close = () => { bg.remove(); messagesView(); };
      bg.addEventListener('click', async (ev) => {
        if (ev.target === bg || ev.target.closest('[data-x]')) return close();
        if (ev.target.closest('[data-read]')) { await sb.from('messages').update({ is_read: !r.is_read }).eq('id', r.id); close(); }
        if (ev.target.closest('[data-del]')) { if (!confirm('Hapus pesan ini?')) return; const { error: er } = await sb.from('messages').delete().eq('id', r.id); if (er) return toast(errText(er), true); close(); }
      });
    };
  }

  start();
})();
