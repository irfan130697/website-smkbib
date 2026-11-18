/* SMK Bina Insan Bangsa - situs publik. Membaca data dari Supabase lewat REST (anon key + RLS). */
(function () {
  'use strict';
  const CFG = window.SMKBIB_CONFIG || {};
  const { esc, rich, fmtDate, initials, waNumber, safeUrl, videoEmbed } = window.U;
  const HAS_DB = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  const HDR = HAS_DB ? { apikey: CFG.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + CFG.SUPABASE_ANON_KEY } : {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const GALLERY_CATS = ['Kegiatan Sekolah', 'Kegiatan Pembelajaran', 'Praktik Jurusan', 'Upacara', 'Ekstrakurikuler', 'Kegiatan Siswa', 'Kegiatan Guru', 'Prestasi', 'Acara Khusus'];

  /* ---------- Data awal (hanya data yang diberikan pemilik sekolah) ---------- */
  const DEFAULTS = {
    identity: {
      school_name: 'SMK Bina Insan Bangsa', short_name: 'SMK BIB',
      foundation: 'Yayasan Pendidikan Bina Insan Bangsa Ngamprah', npsn: '69733880', status: 'Swasta',
      accreditation: 'A', accreditation_valid: '',
      address: 'Jl. Ngamprah No. 1A, Kecamatan Ngamprah, Kabupaten Bandung Barat, Jawa Barat 40552',
      phone: '(022) 86814566', email: '', whatsapp: '', facebook: '', instagram: '', youtube: '', tiktok: '',
      logo_url: '', hero_image: ''
    },
    profile: {
      about: 'SMK Bina Insan Bangsa adalah sekolah menengah kejuruan swasta di bawah naungan Yayasan Pendidikan Bina Insan Bangsa Ngamprah, berlokasi di Kecamatan Ngamprah, Kabupaten Bandung Barat, Jawa Barat.',
      principal_name: '', principal_title: 'Kepala Sekolah', principal_photo: '', principal_message: '',
      history: '', vision: '', mission: '', goals: '', org_image: '', org_note: '',
      advantages_text: 'Pembelajaran berbasis praktik | Penguatan kompetensi kejuruan melalui kegiatan praktik.\nPengembangan karakter | Pembentukan sikap disiplin, tanggung jawab, dan etika kerja.\nPraktik Kerja Lapangan (PKL) | Pengalaman belajar langsung di dunia usaha dan dunia industri.\nHubungan dengan dunia usaha dan industri | Keterkaitan pembelajaran dengan kebutuhan dunia kerja.'
    },
    ppdb: { registration_open: false, year: '', intro: '', requirements: '', flow: '', schedule: '', fee_info: '', contact_name: '', contact_phone: '' }
  };
  // Dipakai HANYA saat database belum terhubung (pratinjau lokal).
  const PREVIEW_PROGRAMS = [
    { slug: 'tkj', code: 'TKJ', name: 'Teknik Komputer dan Jaringan', summary: 'Mempelajari perakitan komputer, jaringan, dan administrasi server.', description: '<p>Teknik Komputer dan Jaringan (TKJ) membekali peserta didik dengan kompetensi merakit, memasang, mengonfigurasi, dan memelihara perangkat komputer serta jaringan komputer.</p>', competencies: '<ul><li>Perakitan dan perawatan komputer</li><li>Jaringan komputer (LAN/WAN)</li><li>Administrasi sistem server</li></ul>', careers: '<ul><li>Teknisi komputer</li><li>Administrator jaringan</li><li>IT support</li></ul>' },
    { slug: 'tbsm', code: 'TBSM', name: 'Teknik dan Bisnis Sepeda Motor', summary: 'Mempelajari servis, perawatan, dan bisnis bengkel sepeda motor.', description: '<p>Teknik dan Bisnis Sepeda Motor (TBSM) membekali peserta didik dengan kompetensi perawatan dan perbaikan sepeda motor serta dasar pengelolaan usaha bengkel.</p>', competencies: '<ul><li>Pemeliharaan mesin</li><li>Pemeliharaan kelistrikan</li><li>Dasar manajemen bengkel</li></ul>', careers: '<ul><li>Mekanik sepeda motor</li><li>Service advisor</li><li>Wirausaha bengkel</li></ul>' },
    { slug: 'bdp', code: 'BDP', name: 'Bisnis Daring dan Pemasaran', summary: 'Mempelajari pemasaran digital, penjualan daring, dan layanan pelanggan.', description: '<p>Bisnis Daring dan Pemasaran (BDP) membekali peserta didik dengan kompetensi pemasaran, penjualan melalui platform digital, dan pelayanan pelanggan.</p>', competencies: '<ul><li>Pemasaran digital</li><li>Pengelolaan toko daring</li><li>Layanan pelanggan</li></ul>', careers: '<ul><li>Staf pemasaran digital</li><li>Admin marketplace</li><li>Wirausaha daring</li></ul>' }
  ];

  /* ---------- Akses data ---------- */
  // Mengembalikan array (sukses), null (database belum terhubung), atau undefined (gagal memuat).
  async function sel(table, q) {
    if (!HAS_DB) return null;
    try {
      const r = await fetch(CFG.SUPABASE_URL + '/rest/v1/' + table + '?' + (q || ''), { headers: HDR });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { console.warn('[smkbib] gagal memuat', table, e); return undefined; }
  }
  async function insertRow(table, body) {
    const r = await fetch(CFG.SUPABASE_URL + '/rest/v1/' + table, {
      method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }, HDR), body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
  }
  async function getSettings() {
    const S = { identity: Object.assign({}, DEFAULTS.identity), profile: Object.assign({}, DEFAULTS.profile), ppdb: Object.assign({}, DEFAULTS.ppdb) };
    const rows = await sel('settings', 'select=key,value');
    if (Array.isArray(rows)) rows.forEach((r) => {
      if (!S[r.key] || !r.value) return;
      Object.keys(r.value).forEach((k) => { const v = r.value[k]; if (v !== '' && v !== null && v !== undefined) S[r.key][k] = v; });
    });
    return S;
  }
  async function getPrograms() {
    if (!HAS_DB) return PREVIEW_PROGRAMS;
    return sel('programs', 'select=*&is_published=eq.true&order=sort_order.asc');
  }

  /* ---------- Potongan HTML ---------- */
  const emptyBox = (title, text) => '<div class="empty"><b>' + esc(title) + '</b>' + esc(text || '') + '</div>';
  const failBox = () => emptyBox('Konten belum dapat dimuat', 'Periksa koneksi internet Anda lalu muat ulang halaman.');
  function state(arr, title, text) {
    if (arr === undefined) return failBox();
    if (!arr || !arr.length) return emptyBox(title, text);
    return '';
  }
  const thumb = (url, alt) => {
    const u = safeUrl(url);
    return u ? '<div class="thumb"><img src="' + esc(u) + '" alt="' + esc(alt) + '" loading="lazy"></div>' : '<div class="thumb ph" role="img" aria-label="Belum ada foto"></div>';
  };
  const plain = (html, n) => {
    const t = document.createElement('div'); t.innerHTML = rich(html);
    const s = (t.textContent || '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s;
  };
  const head = (eyebrow, title, sub, left) =>
    '<div class="section-head' + (left ? ' left' : '') + ' reveal"><span class="eyebrow">' + esc(eyebrow) + '</span><h2>' + esc(title) + '</h2>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>';
  const pageHero = (title, sub, crumb) =>
    '<section class="page-hero"><div class="container"><div class="crumbs"><a href="index.html">Beranda</a> / ' + esc(crumb || title) + '</div><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div></section>';

  function newsCard(n) {
    return '<article class="card hover reveal"><a href="berita.html?id=' + esc(n.id) + '" style="color:inherit;text-decoration:none;display:block">' + thumb(n.image_url, n.title) +
      '<div class="card-body"><div class="meta"><span class="tag">' + esc(n.category) + '</span><time datetime="' + esc(n.published_at) + '">' + esc(fmtDate(n.published_at)) + '</time></div>' +
      '<h3>' + esc(n.title) + '</h3><p>' + esc(n.summary || '') + '</p><span class="link-more">Baca selengkapnya →</span></div></a></article>';
  }
  function programCard(p) {
    return '<article class="card hover prog-card reveal"><a href="program.html?k=' + esc(p.slug) + '" style="color:inherit;text-decoration:none;display:block"><div style="position:relative"><span class="code">' + esc(p.code) + '</span>' + thumb(p.image_url, p.name) + '</div>' +
      '<div class="card-body"><h3>' + esc(p.name) + '</h3><p>' + esc(p.summary || '') + '</p><span class="link-more">Detail program →</span></div></a></article>';
  }
  function galTile(g, group, i) {
    const emb = g.media_type === 'video' ? videoEmbed(g.url) : null;
    let inner;
    if (g.media_type === 'video') {
      const yt = emb && emb.match(/embed\/([\w-]{11})/);
      inner = (yt ? '<img src="https://i.ytimg.com/vi/' + yt[1] + '/hqdefault.jpg" alt="' + esc(g.title) + '" loading="lazy">' : '<div class="vid-ph"></div>') + '<span class="play"><i></i></span>';
    } else inner = '<img src="' + esc(safeUrl(g.url)) + '" alt="' + esc(g.title) + '" loading="lazy">';
    return '<figure><button type="button" data-lb="' + group + '" data-i="' + i + '" aria-label="Perbesar: ' + esc(g.title) + '">' + inner + '</button><figcaption>' + esc(g.title) + '</figcaption></figure>';
  }

  /* ---------- Lightbox ---------- */
  const GROUPS = {};
  const LB = { el: null, items: [], i: 0, last: null,
    build() {
      const d = document.createElement('div');
      d.className = 'lightbox'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Tampilan besar');
      d.innerHTML = '<button class="lb-btn lb-close" aria-label="Tutup">×</button><button class="lb-btn lb-prev" aria-label="Sebelumnya">‹</button><div class="stage"></div><button class="lb-btn lb-next" aria-label="Berikutnya">›</button>';
      document.body.appendChild(d); this.el = d;
      d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('.lb-close')) this.close(); if (e.target.closest('.lb-prev')) this.go(-1); if (e.target.closest('.lb-next')) this.go(1); });
      document.addEventListener('keydown', (e) => { if (!d.classList.contains('open')) return; if (e.key === 'Escape') this.close(); if (e.key === 'ArrowLeft') this.go(-1); if (e.key === 'ArrowRight') this.go(1); });
    },
    open(items, i) { if (!this.el) this.build(); this.items = items; this.i = i; this.last = document.activeElement; this.el.classList.add('open'); document.body.style.overflow = 'hidden'; this.show(); $('.lb-close', this.el).focus(); },
    close() { this.el.classList.remove('open'); $('.stage', this.el).innerHTML = ''; document.body.style.overflow = ''; if (this.last) this.last.focus(); },
    go(d) { this.i = (this.i + d + this.items.length) % this.items.length; this.show(); },
    show() {
      const g = this.items[this.i]; let m;
      if (g.media_type === 'video') {
        const emb = videoEmbed(g.url);
        if (emb) m = '<iframe src="' + esc(emb) + '" title="' + esc(g.title) + '" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
        else if (/\.(mp4|webm)(\?|$)/i.test(g.url) && safeUrl(g.url)) m = '<video src="' + esc(safeUrl(g.url)) + '" controls></video>';
        else m = '<p><a style="color:#fff" href="' + esc(safeUrl(g.url)) + '" target="_blank" rel="noopener">Buka video</a></p>';
      } else m = '<img src="' + esc(safeUrl(g.url)) + '" alt="' + esc(g.title) + '">';
      $('.stage', this.el).innerHTML = m + '<p>' + esc(g.title) + ' <small style="opacity:.7">(' + (this.i + 1) + '/' + this.items.length + ')</small></p>';
      $$('.lb-prev,.lb-next', this.el).forEach((b) => (b.style.display = this.items.length > 1 ? '' : 'none'));
    }
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lb]'); if (!b) return;
    const items = GROUPS[b.dataset.lb]; if (items) LB.open(items, parseInt(b.dataset.i, 10) || 0);
  });
  document.addEventListener('error', (e) => { if (e.target && e.target.tagName === 'IMG') e.target.classList.add('img-broken'); }, true);

  /* ---------- Kerangka: header, footer, WA ---------- */
  const NAV = [
    ['home', 'index.html', 'Beranda', 'Beranda'], ['profil', 'profil.html', 'Profil Sekolah', 'Profil'],
    ['program', 'program.html', 'Program Keahlian', 'Program Keahlian'], ['guru', 'guru.html', 'Guru dan Tenaga Kependidikan', 'Guru & Tendik'],
    ['fasilitas', 'fasilitas.html', 'Fasilitas', 'Fasilitas'], ['berita', 'berita.html', 'Berita dan Informasi', 'Berita'],
    ['galeri', 'galeri.html', 'Galeri', 'Galeri'], ['prestasi', 'prestasi.html', 'Prestasi', 'Prestasi'],
    ['ppdb', 'ppdb.html', 'PPDB', 'PPDB'], ['kontak', 'kontak.html', 'Kontak', 'Kontak']
  ];
  function shell(S) {
    const id = S.identity, page = document.body.dataset.page;
    const logo = safeUrl(id.logo_url) || 'assets/img/logo.jpg';
    const nav = NAV.map((n) => '<a href="' + n[1] + '"' + (n[0] === page ? ' aria-current="page"' : '') + ' title="' + esc(n[2]) + '"><span class="d-label">' + esc(n[3]) + '</span><span class="m-label">' + esc(n[2]) + '</span></a>').join('');
    $('#app-header').innerHTML =
      '<header class="site-header"><div class="container header-in">' +
      '<a class="brand" href="index.html" aria-label="' + esc(id.school_name) + ' - Beranda"><img src="' + esc(logo) + '" alt="Logo ' + esc(id.school_name) + '" width="50" height="50"><span><b>' + esc(id.school_name) + '</b><small>Ngamprah · Kabupaten Bandung Barat</small></span></a>' +
      '<nav class="nav" id="nav" aria-label="Menu utama">' + nav + '<a class="btn btn-primary m-only" href="ppdb.html#daftar">Daftar PPDB</a></nav>' +
      '<a class="btn btn-primary btn-sm header-cta" href="ppdb.html#daftar">Daftar PPDB</a>' +
      '<button class="menu-toggle" id="menu-toggle" aria-label="Buka menu" aria-expanded="false" aria-controls="nav"><span></span></button></div></header>';
    const t = $('#menu-toggle'), nv = $('#nav');
    const setMenu = (o) => { nv.classList.toggle('open', o); t.setAttribute('aria-expanded', o); document.body.style.overflow = o ? 'hidden' : ''; };
    t.addEventListener('click', () => setMenu(!nv.classList.contains('open')));
    nv.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    window.addEventListener('scroll', () => $('.site-header').classList.toggle('scrolled', window.scrollY > 8), { passive: true });

    const soc = [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['youtube', 'YouTube'], ['tiktok', 'TikTok']]
      .filter((s) => safeUrl(id[s[0]])).map((s) => '<a href="' + esc(safeUrl(id[s[0]])) + '" target="_blank" rel="noopener noreferrer">' + s[1] + '</a>').join('');
    const wa = waNumber(id.whatsapp);
    $('#app-footer').innerHTML =
      '<footer class="site-footer"><div class="container"><div class="foot">' +
      '<div><a class="brand" href="index.html"><img src="' + esc(logo) + '" alt="" width="50" height="50"><span><b>' + esc(id.school_name) + '</b><small>' + esc(id.foundation) + '</small></span></a>' +
      '<p style="font-size:.93rem">' + esc(id.address) + '</p>' + (soc ? '<div class="social">' + soc + '</div>' : '') + '</div>' +
      '<div><h4>Navigasi</h4><ul>' + NAV.map((n) => '<li><a href="' + n[1] + '">' + esc(n[2]) + '</a></li>').join('') + '</ul></div>' +
      '<div><h4>Kontak</h4><ul><li>Telepon: <a href="tel:' + esc(id.phone.replace(/[^\d+]/g, '')) + '">' + esc(id.phone) + '</a></li>' +
      (id.email ? '<li>Email: <a href="mailto:' + esc(id.email) + '">' + esc(id.email) + '</a></li>' : '') +
      (wa ? '<li>WhatsApp: <a href="https://wa.me/' + wa + '" target="_blank" rel="noopener noreferrer">+' + wa + '</a></li>' : '') +
      '<li>NPSN: ' + esc(id.npsn) + '</li></ul></div></div>' +
      '<div class="copy"><span>© ' + new Date().getFullYear() + ' ' + esc(id.school_name) + '. ' + esc(id.foundation) + '.</span><a href="admin/">Masuk admin</a></div></div></footer>';
    if (wa) {
      const a = document.createElement('a');
      a.className = 'wa'; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.href = 'https://wa.me/' + wa + '?text=' + encodeURIComponent('Halo ' + id.school_name + ', saya ingin bertanya.');
      a.textContent = 'WhatsApp'; a.setAttribute('aria-label', 'Chat WhatsApp');
      document.body.appendChild(a);
    }
    if (!HAS_DB) {
      const n = document.createElement('div');
      n.style.cssText = 'background:#fff3cd;color:#5e4508;text-align:center;padding:8px 14px;font-size:.85rem;font-weight:600';
      n.textContent = 'Mode pratinjau: database belum terhubung (isi assets/js/config.js). Formulir dan konten dari admin belum aktif.';
      document.body.prepend(n);
    }
  }
  function reveal() {
    const els = $$('.reveal:not(.in)');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: .08 });
    els.forEach((e) => io.observe(e));
  }

  /* ---------- Halaman ---------- */
  const PAGES = {};
  const main = () => $('#main');

  PAGES.home = async (S) => {
    const id = S.identity, pr = S.profile;
    const [progs, news, gal] = await Promise.all([
      getPrograms(),
      sel('news', 'select=id,title,category,summary,image_url,published_at&is_published=eq.true&order=published_at.desc&limit=6'),
      sel('gallery', 'select=id,title,category,media_type,url&is_published=eq.true&order=created_at.desc&limit=8')
    ]);
    const advs = String(pr.advantages_text || '').split('\n').map((l) => l.split('|')).filter((a) => a[0] && a[0].trim()).map((a) => ({ t: a[0].trim(), d: (a[1] || '').trim() }));
    const msg = plain(pr.principal_message, 420);
    GROUPS.home = Array.isArray(gal) ? gal : [];
    main().innerHTML =
      '<section class="hero" id="hero"><div class="container hero-in"><div>' +
      '<span class="eyebrow">' + esc(id.foundation) + '</span>' +
      '<h1>Selamat Datang di <em>' + esc(id.school_name) + '</em></h1>' +
      '<p class="lead">Membangun Generasi Kompeten, Berkarakter, dan Siap Menghadapi Dunia Kerja.</p>' +
      '<div class="hero-cta"><a class="btn btn-gold" href="#profil-singkat">Jelajahi Sekolah</a><a class="btn btn-ghost" href="ppdb.html">Informasi PPDB</a></div>' +
      '<div class="hero-badge"><span class="chip">NPSN ' + esc(id.npsn) + '</span><span class="chip">Akreditasi ' + esc(id.accreditation) + '</span><span class="chip">Sekolah ' + esc(id.status) + '</span></div></div>' +
      '<div class="hero-logo"><div class="ring"><img src="' + esc(safeUrl(id.logo_url) || 'assets/img/logo.jpg') + '" alt="Logo ' + esc(id.school_name) + '"></div></div></div></section>' +

      '<section class="section" id="sambutan"><div class="container split">' +
      '<div class="portrait reveal">' + (safeUrl(pr.principal_photo) ? '<img src="' + esc(safeUrl(pr.principal_photo)) + '" alt="' + esc(pr.principal_name || pr.principal_title) + '">' : '<span class="initials">' + esc(initials(pr.principal_name || 'Kepala Sekolah')) + '</span>') + '</div>' +
      '<div class="reveal"><span class="eyebrow" style="color:var(--blue)">Sambutan</span><h2>Sambutan ' + esc(pr.principal_title) + '</h2>' +
      (msg ? '<p class="quote">' + esc(msg) + '</p>' : emptyBox('Sambutan belum dipublikasikan', 'Sambutan kepala sekolah akan segera ditampilkan di sini.')) +
      (pr.principal_name ? '<p><b>' + esc(pr.principal_name) + '</b><br><span style="color:var(--muted)">' + esc(pr.principal_title) + ' ' + esc(id.school_name) + '</span></p>' : '') +
      '<a class="btn btn-outline" href="profil.html#sambutan">Baca selengkapnya</a></div></div></section>' +

      '<section class="section alt" id="profil-singkat"><div class="container">' + head('Profil Singkat', 'Mengenal ' + id.school_name, pr.about, true) +
      '<div class="facts reveal" style="grid-template-columns:repeat(auto-fit,minmax(210px,1fr))">' +
      [['Nama sekolah', id.school_name], ['Yayasan', id.foundation], ['NPSN', id.npsn], ['Status', id.status], ['Akreditasi', id.accreditation], ['Telepon', id.phone]].map((f) => '<div class="fact"><small>' + f[0] + '</small><b>' + esc(f[1]) + '</b></div>').join('') +
      '<div class="fact" style="grid-column:1/-1"><small>Alamat</small><b>' + esc(id.address) + '</b></div></div>' +
      '<a class="link-more" href="profil.html">Lihat profil lengkap →</a></div></section>' +

      '<section class="section" id="program"><div class="container">' + head('Program Keahlian', 'Pilih Jalur Kompetensimu', 'Program keahlian untuk membekali peserta didik dengan keterampilan siap kerja.') +
      (state(progs, 'Program keahlian belum dipublikasikan', 'Informasi program keahlian akan segera ditampilkan.') || '<div class="grid g3">' + progs.map(programCard).join('') + '</div>') + '</div></section>' +

      '<section class="section alt" id="keunggulan"><div class="container">' + head('Keunggulan', 'Mengapa ' + id.short_name + '?', 'Komitmen sekolah dalam menyiapkan peserta didik.') +
      (advs.length ? '<div class="grid g4">' + advs.map((a, i) => '<div class="card adv reveal"><div class="ico">' + (i + 1) + '</div><h3>' + esc(a.t) + '</h3><p>' + esc(a.d) + '</p></div>').join('') + '</div>' : emptyBox('Keunggulan belum diisi', 'Admin dapat mengisinya di dashboard.')) + '</div></section>' +

      '<section class="section" id="berita"><div class="container">' + head('Berita Terbaru', 'Kabar dari Sekolah', 'Informasi dan kegiatan terbaru.') +
      (state(news, 'Belum ada berita', 'Berita sekolah akan tampil di sini setelah dipublikasikan.') || '<div class="grid g3">' + news.map(newsCard).join('') + '</div><p class="pager"><a class="btn btn-outline" href="berita.html">Semua berita</a></p>') + '</div></section>' +

      '<section class="section alt" id="galeri"><div class="container">' + head('Galeri Kegiatan', 'Momen di ' + id.short_name, 'Belajar mengajar, praktik kejuruan, upacara, ekstrakurikuler, dan prestasi.') +
      (state(gal, 'Galeri masih kosong', 'Foto kegiatan akan tampil di sini setelah diunggah.') || '<div class="gal reveal">' + gal.map((g, i) => galTile(g, 'home', i)).join('') + '</div><p class="pager"><a class="btn btn-outline" href="galeri.html">Lihat galeri lengkap</a></p>') + '</div></section>' +

      '<section class="section" id="ppdb-banner"><div class="container"><div class="ppdb-banner reveal"><div><span class="eyebrow">Penerimaan Peserta Didik Baru</span><h2>' + (S.ppdb.year ? 'PPDB ' + esc(S.ppdb.year) + ' ' : 'PPDB ') + esc(id.school_name) + '</h2><p>Informasi pendaftaran, persyaratan, dan alur penerimaan peserta didik baru.</p></div><a class="btn btn-gold" href="ppdb.html#daftar">Daftar Sekarang</a></div></div></section>';
    const hi = safeUrl(id.hero_image);
    if (hi) $('#hero').style.backgroundImage = 'url("' + encodeURI(hi) + '")';
  };

  PAGES.profil = async (S) => {
    const id = S.identity, pr = S.profile;
    const teachers = await sel('teachers', 'select=id,category&is_published=eq.true');
    const blk = (idn, title, html, extra) => '<div class="block reveal" id="' + idn + '"><h2>' + esc(title) + '</h2>' + (html ? '<div class="prose">' + html + '</div>' : '<p style="color:var(--muted);margin:0">Informasi ini belum dipublikasikan oleh sekolah.</p>') + (extra || '') + '</div>';
    const cnt = Array.isArray(teachers) ? teachers.reduce((a, t) => { a[t.category] = (a[t.category] || 0) + 1; return a; }, {}) : null;
    main().innerHTML = pageHero('Profil Sekolah', 'Mengenal ' + id.school_name + ' lebih dekat.') +
      '<section class="section"><div class="container" style="max-width:980px">' +
      '<div class="block reveal" id="identitas"><h2>Identitas Sekolah</h2><div style="text-align:center;margin-bottom:18px"><img src="' + esc(safeUrl(id.logo_url) || 'assets/img/logo.jpg') + '" alt="Logo ' + esc(id.school_name) + '" width="140" height="140" style="margin:0 auto"></div>' +
      (pr.about ? '<p>' + esc(pr.about) + '</p>' : '') +
      '<div class="facts">' + [['Nama sekolah', id.school_name], ['Yayasan', id.foundation], ['NPSN', id.npsn], ['Status', id.status], ['Telepon', id.phone], ['Email', id.email || 'Belum dicantumkan']].map((f) => '<div class="fact"><small>' + f[0] + '</small><b>' + esc(f[1]) + '</b></div>').join('') +
      '<div class="fact" style="grid-column:1/-1"><small>Alamat</small><b>' + esc(id.address) + '</b></div></div></div>' +
      blk('sejarah', 'Sejarah Berdirinya Sekolah', rich(pr.history)) +
      blk('visi-misi', 'Visi dan Misi', (pr.vision ? '<h3>Visi</h3>' + rich(pr.vision) : '') + (pr.mission ? '<h3>Misi</h3>' + rich(pr.mission) : '')) +
      blk('tujuan', 'Tujuan Sekolah', rich(pr.goals)) +
      blk('struktur', 'Struktur Organisasi', rich(pr.org_note), safeUrl(pr.org_image) ? '<img src="' + esc(safeUrl(pr.org_image)) + '" alt="Bagan struktur organisasi" style="margin-top:16px;border-radius:14px;width:100%" loading="lazy">' : '') +
      '<div class="block reveal" id="sambutan"><h2>Sambutan ' + esc(pr.principal_title) + '</h2>' +
      (pr.principal_message ? '<div class="split" style="grid-template-columns:240px 1fr;gap:28px"><div class="portrait">' + (safeUrl(pr.principal_photo) ? '<img src="' + esc(safeUrl(pr.principal_photo)) + '" alt="' + esc(pr.principal_name) + '">' : '<span class="initials">' + esc(initials(pr.principal_name || 'KS')) + '</span>') + '</div><div class="prose">' + rich(pr.principal_message) + (pr.principal_name ? '<p><b>' + esc(pr.principal_name) + '</b><br>' + esc(pr.principal_title) + '</p>' : '') + '</div></div>' : '<p style="color:var(--muted);margin:0">Sambutan belum dipublikasikan oleh sekolah.</p>') + '</div>' +
      '<div class="block reveal" id="pendidik"><h2>Pendidik dan Tenaga Kependidikan</h2>' +
      (cnt && Object.keys(cnt).length ? '<p>' + Object.keys(cnt).map((k) => cnt[k] + ' ' + esc(k)).join(' · ') + '</p>' : '<p style="color:var(--muted)">Data pendidik dan tenaga kependidikan belum dipublikasikan.</p>') + '<a class="link-more" href="guru.html">Lihat daftar lengkap →</a></div>' +
      '<div class="block reveal" id="akreditasi"><h2>Akreditasi</h2><p style="font-size:1.1rem"><span class="tag gold" style="font-size:1rem">Akreditasi ' + esc(id.accreditation) + '</span></p><p style="color:var(--muted);margin:0">' + (id.accreditation_valid ? 'Masa berlaku: ' + esc(id.accreditation_valid) : 'Masa berlaku akreditasi belum dicantumkan oleh sekolah.') + '</p></div>' +
      '</div></section>';
  };

  PAGES.program = async (S) => {
    const progs = await getPrograms();
    const k = new URLSearchParams(location.search).get('k');
    const p = k && Array.isArray(progs) ? progs.find((x) => x.slug === k) : null;
    if (!p) {
      main().innerHTML = pageHero('Program Keahlian', 'Jalur kompetensi untuk menyiapkan peserta didik menghadapi dunia kerja.') +
        '<section class="section"><div class="container">' + (state(progs, 'Program keahlian belum dipublikasikan', 'Informasi program keahlian akan segera ditampilkan.') || '<div class="grid g3">' + progs.map(programCard).join('') + '</div>') + '</div></section>';
      return;
    }
    document.title = p.name + ' | ' + S.identity.school_name;
    const gal = await sel('gallery', 'select=id,title,category,media_type,url&is_published=eq.true&program_slug=eq.' + encodeURIComponent(p.slug) + '&order=created_at.desc&limit=12');
    GROUPS.prog = Array.isArray(gal) ? gal : [];
    const sec = (title, html) => html ? '<div class="block reveal"><h2>' + title + '</h2><div class="prose">' + rich(html) + '</div></div>' : '';
    const others = progs.filter((x) => x.slug !== p.slug);
    main().innerHTML = pageHero(p.name, p.summary, p.code) +
      '<section class="section"><div class="container" style="max-width:980px">' +
      (safeUrl(p.image_url) ? '<div class="reveal" style="margin-bottom:22px;border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow)"><img src="' + esc(safeUrl(p.image_url)) + '" alt="' + esc(p.name) + '" style="width:100%"></div>' : '') +
      sec('Deskripsi Jurusan', p.description) + sec('Tujuan Pembelajaran', p.objectives) + sec('Kompetensi yang Dipelajari', p.competencies) +
      sec('Materi Pembelajaran', p.learning_materials) + sec('Fasilitas Pendukung', p.facilities) + sec('Prospek Kerja', p.careers) + sec('Kegiatan Jurusan', p.activities) +
      '<div class="block reveal"><h2>Dokumentasi Praktik</h2>' + (GROUPS.prog.length ? '<div class="gal">' + GROUPS.prog.map((g, i) => galTile(g, 'prog', i)).join('') + '</div>' : '<p style="color:var(--muted);margin:0">Dokumentasi praktik jurusan ini belum diunggah.</p>') + '</div>' +
      '<p class="pager"><a class="btn btn-primary" href="ppdb.html#daftar">Daftar ke ' + esc(p.code) + '</a></p>' +
      (others.length ? '<div class="subhead">Program lainnya</div><div class="grid g2">' + others.map(programCard).join('') + '</div>' : '') +
      '</div></section>';
  };

  PAGES.guru = async () => {
    const t = await sel('teachers', 'select=*&is_published=eq.true&order=sort_order.asc,name.asc');
    let body = state(t, 'Data pendidik belum dipublikasikan', 'Daftar guru dan tenaga kependidikan akan ditampilkan di sini.');
    if (!body) {
      body = ['Pimpinan', 'Guru', 'Tenaga Kependidikan'].map((c) => {
        const L = t.filter((x) => x.category === c); if (!L.length) return '';
        return '<h2 class="subhead">' + c + '</h2><div class="grid g4">' + L.map((x) => '<div class="card person reveal"><div class="avatar">' + (safeUrl(x.photo_url) ? '<img src="' + esc(safeUrl(x.photo_url)) + '" alt="' + esc(x.name) + '" loading="lazy">' : esc(initials(x.name))) + '</div><h3>' + esc(x.name) + '</h3><p>' + esc([x.position, x.subject].filter(Boolean).join(' · ')) + '</p></div>').join('') + '</div>';
      }).join('');
    }
    main().innerHTML = pageHero('Guru dan Tenaga Kependidikan', 'Para pendidik dan tenaga kependidikan yang mendampingi peserta didik.') + '<section class="section"><div class="container">' + body + '</div></section>';
  };

  PAGES.fasilitas = async () => {
    const f = await sel('facilities', 'select=*&is_published=eq.true&order=sort_order.asc,name.asc');
    main().innerHTML = pageHero('Fasilitas', 'Sarana dan prasarana pendukung kegiatan belajar.') + '<section class="section"><div class="container">' +
      (state(f, 'Data fasilitas belum dipublikasikan', 'Daftar fasilitas sekolah akan ditampilkan di sini.') || '<div class="grid g3">' + f.map((x) => '<article class="card hover reveal">' + thumb(x.image_url, x.name) + '<div class="card-body"><h3>' + esc(x.name) + '</h3><p>' + esc(x.description || '') + '</p></div></article>').join('') + '</div>') + '</div></section>';
  };

  PAGES.berita = async (S) => {
    const id = new URLSearchParams(location.search).get('id');
    if (id) {
      const r = UUID.test(id) ? await sel('news', 'select=*&is_published=eq.true&id=eq.' + id) : [];
      const n = Array.isArray(r) ? r[0] : null;
      if (!n) {
        main().innerHTML = pageHero('Berita dan Informasi', '', 'Berita') + '<section class="section"><div class="container">' + (r === undefined ? failBox() : emptyBox('Berita tidak ditemukan', 'Berita mungkin telah dihapus atau belum dipublikasikan.')) + '<p class="pager"><a class="btn btn-primary" href="berita.html">Kembali ke daftar berita</a></p></div></section>';
        return;
      }
      document.title = n.title + ' | ' + S.identity.school_name;
      main().innerHTML = pageHero(n.title, '', 'Berita') +
        '<section class="section"><div class="container"><article class="article">' +
        '<div class="meta"><span class="tag">' + esc(n.category) + '</span><time datetime="' + esc(n.published_at) + '">' + esc(fmtDate(n.published_at)) + '</time></div>' +
        (safeUrl(n.image_url) ? '<div class="cover"><img src="' + esc(safeUrl(n.image_url)) + '" alt="' + esc(n.title) + '"></div>' : '') +
        '<div class="prose">' + rich(n.content || n.summary) + '</div>' +
        '<p class="pager" style="text-align:left;display:flex;gap:12px;flex-wrap:wrap"><a class="btn btn-outline" href="berita.html">← Semua berita</a><a class="btn btn-primary" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=' + encodeURIComponent(n.title + ' ' + location.href) + '">Bagikan via WhatsApp</a></p></article></div></section>';
      return;
    }
    const all = await sel('news', 'select=id,title,category,summary,image_url,published_at&is_published=eq.true&order=published_at.desc&limit=300');
    const cats = Array.isArray(all) ? Array.from(new Set(all.map((x) => x.category))) : [];
    main().innerHTML = pageHero('Berita dan Informasi', 'Kabar terbaru dan pengumuman dari sekolah.') + '<section class="section"><div class="container">' +
      (state(all, 'Belum ada berita', 'Berita sekolah akan tampil di sini setelah dipublikasikan.') ||
        '<div class="toolbar"><label class="search"><span class="hp">Cari berita</span><input id="q" type="search" placeholder="Cari berita…" aria-label="Cari berita"></label><div class="filters" id="cats"><button class="on" data-c="">Semua</button>' + cats.map((c) => '<button data-c="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div></div><div class="grid g3" id="list"></div><p class="pager"><button class="btn btn-outline" id="more">Muat lebih banyak</button></p>') +
      '</div></section>';
    if (!Array.isArray(all) || !all.length) return;
    let cat = '', q = '', shown = 9;
    const draw = () => {
      const L = all.filter((n) => (!cat || n.category === cat) && (!q || (n.title + ' ' + (n.summary || '')).toLowerCase().includes(q)));
      $('#list').innerHTML = L.length ? L.slice(0, shown).map(newsCard).join('') : '<div style="grid-column:1/-1">' + emptyBox('Tidak ada hasil', 'Coba kata kunci atau kategori lain.') + '</div>';
      $('#more').style.display = L.length > shown ? '' : 'none';
      reveal();
    };
    $('#q').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); shown = 9; draw(); });
    $('#cats').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; cat = b.dataset.c; shown = 9; $$('#cats button').forEach((x) => x.classList.toggle('on', x === b)); draw(); });
    $('#more').addEventListener('click', () => { shown += 9; draw(); });
    draw();
  };

  PAGES.galeri = async () => {
    const all = await sel('gallery', 'select=id,title,category,media_type,url&is_published=eq.true&order=created_at.desc&limit=300');
    const present = Array.isArray(all) ? GALLERY_CATS.concat(all.map((g) => g.category)).filter((c, i, a) => a.indexOf(c) === i && all.some((g) => g.category === c)) : [];
    main().innerHTML = pageHero('Galeri', 'Dokumentasi foto dan video kegiatan sekolah.') + '<section class="section"><div class="container">' +
      (state(all, 'Galeri masih kosong', 'Foto dan video kegiatan akan tampil di sini setelah diunggah.') ||
        '<div class="filters" id="cats"><button class="on" data-c="">Semua</button>' + present.map((c) => '<button data-c="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div><div class="gal" id="grid"></div>') + '</div></section>';
    if (!Array.isArray(all) || !all.length) return;
    const draw = (c) => { const L = all.filter((g) => !c || g.category === c); GROUPS.gal = L; $('#grid').innerHTML = L.map((g, i) => galTile(g, 'gal', i)).join(''); };
    $('#cats').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; $$('#cats button').forEach((x) => x.classList.toggle('on', x === b)); draw(b.dataset.c); });
    draw('');
  };

  PAGES.prestasi = async () => {
    const a = await sel('achievements', 'select=*&is_published=eq.true&order=year.desc.nullslast,created_at.desc');
    main().innerHTML = pageHero('Prestasi', 'Capaian peserta didik, guru, dan sekolah.') + '<section class="section"><div class="container">' +
      (state(a, 'Data prestasi belum dipublikasikan', 'Prestasi siswa dan guru akan ditampilkan di sini.') ||
        '<div class="filters" id="cats"><button class="on" data-c="">Semua</button>' + ['Siswa', 'Guru', 'Sekolah'].filter((c) => a.some((x) => x.owner_type === c)).map((c) => '<button data-c="' + c + '">' + c + '</button>').join('') + '</div><div class="grid g3" id="grid"></div>') + '</div></section>';
    if (!Array.isArray(a) || !a.length) return;
    const draw = (c) => {
      $('#grid').innerHTML = a.filter((x) => !c || x.owner_type === c).map((x) => '<article class="card hover reveal">' + (safeUrl(x.image_url) ? thumb(x.image_url, x.title) : '') + '<div class="card-body"><div class="meta"><span class="tag gold">' + esc(x.owner_type) + '</span>' + (x.year ? '<span>' + esc(x.year) + '</span>' : '') + (x.level ? '<span>' + esc(x.level) + '</span>' : '') + '</div><h3>' + esc(x.title) + '</h3><p>' + esc(x.description || '') + '</p></div></article>').join('');
      reveal();
    };
    $('#cats').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; $$('#cats button').forEach((x) => x.classList.toggle('on', x === b)); draw(b.dataset.c); });
    draw('');
  };

  const DOCS = [['doc_kk', 'Kartu Keluarga'], ['doc_ijazah', 'Ijazah / SKL / Rapor'], ['doc_akta', 'Akta Kelahiran'], ['doc_foto', 'Pas Foto']];
  const DOC_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };

  PAGES.ppdb = async (S) => {
    const pp = S.ppdb, id = S.identity;
    const progs = await getPrograms();
    const open = !!pp.registration_open && HAS_DB;
    const blk = (t, h) => h ? '<div class="block reveal"><h2>' + t + '</h2><div class="prose">' + rich(h) + '</div></div>' : '';
    const info = blk('Informasi Pendaftaran', pp.intro) + blk('Persyaratan Calon Siswa', pp.requirements) + blk('Alur Pendaftaran', pp.flow) + blk('Jadwal Pendaftaran', pp.schedule) + blk('Biaya dan Informasi Lain', pp.fee_info);
    const wa = waNumber(pp.contact_phone) || waNumber(id.whatsapp);
    const options = Array.isArray(progs) ? progs.map((p) => '<option value="' + esc(p.code) + '">' + esc(p.name) + ' (' + esc(p.code) + ')</option>').join('') : '';
    const docField = (f) => '<label>' + f[1] + ' <small>(JPG/PNG/PDF, maks. 2 MB, opsional)</small><input type="file" name="' + f[0] + '" accept="image/jpeg,image/png,application/pdf"></label>';
    main().innerHTML = pageHero('PPDB' + (pp.year ? ' ' + pp.year : ''), 'Penerimaan Peserta Didik Baru ' + id.school_name + '.') +
      '<section class="section"><div class="container" style="max-width:980px">' +
      (info || emptyBox('Informasi PPDB belum dipublikasikan', 'Informasi pendaftaran akan diumumkan oleh panitia. Silakan hubungi sekolah.')) +
      '<div class="block reveal"><h2>Kontak Panitia PPDB</h2><p>' + (pp.contact_name ? '<b>' + esc(pp.contact_name) + '</b><br>' : '') + 'Telepon sekolah: <a href="tel:' + esc(id.phone.replace(/[^\d+]/g, '')) + '">' + esc(id.phone) + '</a>' +
      (pp.contact_phone ? '<br>Kontak panitia: ' + esc(pp.contact_phone) : '') + '</p>' + (wa ? '<a class="btn btn-primary btn-sm" target="_blank" rel="noopener noreferrer" href="https://wa.me/' + wa + '?text=' + encodeURIComponent('Halo, saya ingin bertanya tentang PPDB ' + id.school_name) + '">Hubungi via WhatsApp</a>' : '') + '</div>' +
      '<div class="block reveal" id="daftar"><h2>Formulir Pendaftaran Online</h2>' +
      (open ? '<div id="msg" role="status" aria-live="polite"></div><form class="f" id="ppdb-form" novalidate>' +
        '<div class="hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>' +
        '<fieldset><legend>Data calon siswa</legend><label>Nama lengkap *<input name="full_name" required maxlength="120" autocomplete="name"></label>' +
        '<div class="row"><label>NISN <small>(jika ada)</small><input name="nisn" inputmode="numeric" maxlength="20"></label><label>Jenis kelamin *<select name="gender" required><option value="">Pilih…</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></label></div>' +
        '<div class="row"><label>Tempat lahir *<input name="birth_place" required maxlength="80"></label><label>Tanggal lahir *<input type="date" name="birth_date" required></label></div>' +
        '<label>Alamat lengkap *<textarea name="address" required maxlength="400" style="min-height:90px"></textarea></label>' +
        '<div class="row"><label>Asal sekolah (SMP/MTs) *<input name="previous_school" required maxlength="120"></label><label>Pilihan program keahlian *<select name="program_code" required><option value="">Pilih…</option>' + options + '<option value="BELUM">Belum menentukan</option></select></label></div></fieldset>' +
        '<fieldset><legend>Data orang tua / wali</legend><div class="row"><label>Nama orang tua / wali *<input name="parent_name" required maxlength="120"></label><label>No. HP / WhatsApp orang tua *<input name="parent_phone" type="tel" required maxlength="20" inputmode="tel"></label></div>' +
        '<div class="row"><label>No. HP calon siswa <small>(opsional)</small><input name="student_phone" type="tel" maxlength="20" inputmode="tel"></label><label>Email <small>(opsional)</small><input name="email" type="email" maxlength="120"></label></div></fieldset>' +
        '<fieldset><legend>Dokumen (opsional)</legend>' + DOCS.map(docField).join('') + '</fieldset>' +
        '<label class="check"><input type="checkbox" name="consent" required> <span>Saya menyatakan bahwa data yang diisi benar dan menyetujui data ini diproses oleh sekolah untuk keperluan PPDB.</span></label>' +
        '<button class="btn btn-primary" type="submit" id="submit">Kirim Pendaftaran</button></form>'
        : '<div class="notice">' + (HAS_DB ? 'Pendaftaran online belum dibuka. Silakan hubungi panitia PPDB atau pantau halaman ini untuk pengumuman jadwal.' : 'Formulir aktif setelah database Supabase dihubungkan.') + '</div>') + '</div></div></section>';
    if (!open) return;
    const form = $('#ppdb-form'), msg = $('#msg');
    const say = (cls, t) => { msg.innerHTML = '<div class="notice ' + cls + '">' + t + '</div>'; msg.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form), v = (k) => String(fd.get(k) || '').trim();
      if (v('website')) return say('ok', 'Terima kasih.');
      const last = +localStorage.getItem('ppdb_last') || 0;
      if (Date.now() - last < 30000) return say('err', 'Mohon tunggu sebentar sebelum mengirim lagi.');
      if (v('full_name').length < 3 || v('parent_name').length < 3) return say('err', 'Nama minimal 3 karakter.');
      if (!/^[0-9+\-\s()]{8,20}$/.test(v('parent_phone'))) return say('err', 'Nomor HP orang tua tidak valid (8–20 angka).');
      if (v('student_phone') && !/^[0-9+\-\s()]{8,20}$/.test(v('student_phone'))) return say('err', 'Nomor HP calon siswa tidak valid.');
      if (v('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))) return say('err', 'Format email tidak valid.');
      if (!v('gender') || !v('birth_place') || !v('birth_date') || !v('address') || !v('previous_school') || !v('program_code')) return say('err', 'Lengkapi semua kolom bertanda *.');
      const bd = new Date(v('birth_date')), age = (Date.now() - bd) / 3.15576e10;
      if (isNaN(bd) || age < 10 || age > 30) return say('err', 'Periksa kembali tanggal lahir.');
      if (!form.elements.consent.checked) return say('err', 'Centang pernyataan persetujuan terlebih dahulu.');
      for (const d of DOCS) { const f = form.elements[d[0]].files[0]; if (!f) continue; if (!DOC_TYPES[f.type]) return say('err', d[1] + ': format harus JPG, PNG, atau PDF.'); if (f.size > 2097152) return say('err', d[1] + ': ukuran maksimal 2 MB.'); }
      const btn = $('#submit'); btn.disabled = true; btn.textContent = 'Mengirim…'; msg.innerHTML = '';
      try {
        const rid = crypto.randomUUID(), code = 'PPDB-' + rid.replace(/-/g, '').slice(0, 8).toUpperCase(), docs = [];
        for (const d of DOCS) {
          const f = form.elements[d[0]].files[0]; if (!f) continue;
          const path = rid + '/' + d[0] + '.' + DOC_TYPES[f.type];
          const r = await fetch(CFG.SUPABASE_URL + '/storage/v1/object/ppdb-docs/' + path, { method: 'POST', headers: Object.assign({ 'Content-Type': f.type, 'x-upsert': 'false' }, HDR), body: f });
          if (!r.ok) throw new Error('upload ' + r.status);
          docs.push({ label: d[1], path: path, name: f.name });
        }
        await insertRow('applicants', {
          id: rid, reg_code: code, full_name: v('full_name'), nisn: v('nisn') || null, birth_place: v('birth_place'), birth_date: v('birth_date'), gender: v('gender'),
          address: v('address'), previous_school: v('previous_school'), program_code: v('program_code'), parent_name: v('parent_name'), parent_phone: v('parent_phone'),
          student_phone: v('student_phone') || null, email: v('email') || null, documents: docs
        });
        localStorage.setItem('ppdb_last', String(Date.now()));
        form.reset(); form.style.display = 'none';
        say('ok', '<b>Pendaftaran terkirim.</b> Nomor pendaftaran Anda: <b>' + code + '</b>. Simpan nomor ini dan tunggu informasi dari panitia.');
      } catch (err) {
        console.warn(err);
        say('err', 'Pendaftaran gagal dikirim. Periksa koneksi lalu coba lagi, atau hubungi panitia PPDB.');
        btn.disabled = false; btn.textContent = 'Kirim Pendaftaran';
      }
    });
  };

  PAGES.kontak = async (S) => {
    const id = S.identity, wa = waNumber(id.whatsapp);
    const mapQ = encodeURIComponent(id.school_name + ', ' + id.address);
    const row = (ico, t, v) => '<div class="info"><div class="ico">' + ico + '</div><div><b>' + t + '</b>' + v + '</div></div>';
    main().innerHTML = pageHero('Kontak', 'Hubungi kami untuk informasi lebih lanjut.') + '<section class="section"><div class="container"><div class="grid g2" style="align-items:start">' +
      '<div class="block reveal"><h2>Informasi Kontak</h2><div class="info-list">' +
      row('📍', 'Alamat', '<span>' + esc(id.address) + '</span>') +
      row('☎', 'Telepon', '<a href="tel:' + esc(id.phone.replace(/[^\d+]/g, '')) + '">' + esc(id.phone) + '</a>') +
      (id.email ? row('✉', 'Email', '<a href="mailto:' + esc(id.email) + '">' + esc(id.email) + '</a>') : '') +
      (wa ? row('💬', 'WhatsApp', '<a target="_blank" rel="noopener noreferrer" href="https://wa.me/' + wa + '">+' + wa + '</a>') : '') + '</div>' +
      '<p style="margin-top:20px"><a class="btn btn-outline btn-sm" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=' + mapQ + '">Buka di Google Maps</a></p></div>' +
      '<div class="block reveal"><h2>Kirim Pesan</h2><div id="msg" role="status" aria-live="polite"></div>' +
      (HAS_DB ? '<form class="f" id="cform" novalidate><div class="hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>' +
        '<div class="row"><label>Nama *<input name="name" required maxlength="120" autocomplete="name"></label><label>Email <small>(opsional)</small><input name="email" type="email" maxlength="120" autocomplete="email"></label></div>' +
        '<div class="row"><label>No. HP <small>(opsional)</small><input name="phone" type="tel" maxlength="20" autocomplete="tel"></label><label>Subjek<input name="subject" maxlength="160"></label></div>' +
        '<label>Pesan *<textarea name="message" required maxlength="4000"></textarea></label><button class="btn btn-primary" id="csend" type="submit">Kirim Pesan</button></form>'
        : '<div class="notice">Formulir pesan aktif setelah database Supabase dihubungkan.</div>') + '</div></div>' +
      '<iframe class="map reveal" style="margin-top:28px" title="Peta lokasi ' + esc(id.school_name) + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=' + mapQ + '&output=embed"></iframe></div></section>';
    const f = $('#cform'); if (!f) return;
    const msg = $('#msg');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(f), v = (k) => String(fd.get(k) || '').trim();
      const say = (c, t) => { msg.innerHTML = '<div class="notice ' + c + '">' + t + '</div>'; };
      if (v('website')) return say('ok', 'Terima kasih.');
      const last = +localStorage.getItem('msg_last') || 0;
      if (Date.now() - last < 20000) return say('err', 'Mohon tunggu sebentar sebelum mengirim lagi.');
      if (v('name').length < 2 || v('message').length < 5) return say('err', 'Isi nama dan pesan (minimal 5 karakter).');
      if (v('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))) return say('err', 'Format email tidak valid.');
      const b = $('#csend'); b.disabled = true; b.textContent = 'Mengirim…';
      try {
        await insertRow('messages', { name: v('name'), email: v('email') || null, phone: v('phone') || null, subject: v('subject') || null, message: v('message') });
        localStorage.setItem('msg_last', String(Date.now()));
        f.reset(); say('ok', 'Pesan terkirim. Terima kasih, kami akan menghubungi Anda.');
      } catch (err) { console.warn(err); say('err', 'Pesan gagal dikirim. Coba lagi atau hubungi kami lewat telepon.'); }
      b.disabled = false; b.textContent = 'Kirim Pesan';
    });
  };

  /* ---------- Mulai ---------- */
  async function boot() {
    const S = await getSettings();
    shell(S);
    const fn = PAGES[document.body.dataset.page];
    try { if (fn) await fn(S); } catch (e) { console.error(e); main().innerHTML = '<div class="container section">' + failBox() + '</div>'; }
    reveal();
    if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(() => t.scrollIntoView(), 60); }
  }
  boot();
})();
