/* Utilitas bersama untuk situs publik dan dashboard admin. */
(function () {
  'use strict';

  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---- Sanitasi HTML dari editor (daftar putih) ----
  const ALLOWED = {
    P: [], BR: [], B: [], STRONG: [], I: [], EM: [], U: [], UL: [], OL: [], LI: [],
    H2: [], H3: [], H4: [], BLOCKQUOTE: [], DIV: [], SPAN: [], A: ['href'], IMG: ['src', 'alt']
  };
  const DROP = ['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'TEMPLATE', 'FORM', 'SVG', 'MATH'];

  function sanitize(html) {
    const doc = new DOMParser().parseFromString('<body>' + String(html || '') + '</body>', 'text/html');
    const out = document.createElement('div');
    (function walk(src, dst) {
      src.childNodes.forEach((n) => {
        if (n.nodeType === 3) { dst.appendChild(document.createTextNode(n.nodeValue)); return; }
        if (n.nodeType !== 1) return;
        const tag = n.tagName.toUpperCase();
        if (!(tag in ALLOWED)) {
          if (DROP.includes(tag)) return;
          walk(n, dst); // tag tak dikenal: buang tag, simpan isinya
          return;
        }
        const el = document.createElement(tag);
        for (const a of ALLOWED[tag]) {
          if (!n.hasAttribute(a)) continue;
          const v = n.getAttribute(a).trim();
          if (a === 'href' && !/^(https?:|mailto:|tel:|\/|#)/i.test(v)) continue;
          if (a === 'src' && !/^https:/i.test(v)) continue;
          el.setAttribute(a, v);
        }
        if (tag === 'IMG') { if (!el.getAttribute('src')) return; el.setAttribute('loading', 'lazy'); }
        if (tag === 'A') { el.setAttribute('rel', 'noopener noreferrer'); el.setAttribute('target', '_blank'); }
        walk(n, el);
        dst.appendChild(el);
      });
    })(doc.body, out);
    return out.innerHTML;
  }

  // Teks biasa -> paragraf; HTML -> disanitasi.
  function rich(s) {
    s = String(s || '').trim();
    if (!s) return '';
    if (!/<\/?[a-z][\s\S]*>/i.test(s)) {
      return s.split(/\n{2,}/).map((p) => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join('');
    }
    return sanitize(s);
  }

  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  function fmtDate(d) {
    if (!d) return '';
    const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '';
    return parseInt(m[3], 10) + ' ' + MONTHS[parseInt(m[2], 10) - 1] + ' ' + m[1];
  }

  const slugify = (s) =>
    String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

  const initials = (name) =>
    String(name || '?').replace(/^(drs?\.?|dra\.?|h\.|hj\.)\s+/i, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';

  // Nomor WhatsApp -> format internasional tanpa tanda baca (08xx -> 628xx)
  function waNumber(raw) {
    let d = String(raw || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('0')) d = '62' + d.slice(1);
    else if (d.startsWith('8')) d = '62' + d;
    return d.length >= 9 ? d : '';
  }

  // Hanya terima URL http(s)
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '');

  // YouTube / Vimeo -> URL embed, selain itu null
  function videoEmbed(u) {
    u = String(u || '').trim();
    let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i);
    if (m) return 'https://www.youtube-nocookie.com/embed/' + m[1];
    return null;
  }

  window.U = { esc, sanitize, rich, fmtDate, slugify, initials, waNumber, safeUrl, videoEmbed };
})();
