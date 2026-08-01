/* =========================================================
   ANANTH · Portfolio — interactions
   Vanilla JS. Handles:
   - loader dismiss
   - chalk-dust particle canvas
   - custom cursor
   - language rotator
   - scroll reveals (IntersectionObserver)
   - nav scroll state + mobile toggle
   - timeline filters
   - gallery lightbox
   - reels hover-play
   - footer year
   ========================================================= */
const initAnanth = () => {
  'use strict';

  // guard against double-init (the safety-net setTimeout may race with content:rendered)
  if (document.documentElement.classList.contains('ananth-inited')) return;
  document.documentElement.classList.add('ananth-inited');

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Enable JS-driven animation gates. If reduced-motion, skip so content shows immediately.
  if (!reduced) document.documentElement.classList.add('js-anim');
  else {
    document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-in'));
  }

  /* ---------------- loader ---------------- */
  // Dismiss as soon as init runs (content is already in the DOM by now).
  // Don't wait for window.load — it may have already fired.
  const dismissLoader = () => {
    const l = $('#loader'); if (l) l.classList.add('is-done');
  };
  setTimeout(dismissLoader, reduced ? 100 : 1200);

  /* ---------------- footer year ---------------- */
  const yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();

  /* ---------------- custom cursor ---------------- */
  const cursor = $('#cursor');
  if (cursor && matchMedia('(hover: hover)').matches) {
    let tx = 0, ty = 0, cx = 0, cy = 0;
    document.addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; });
    const step = () => {
      cx += (tx - cx) * 0.22;
      cy += (ty - cy) * 0.22;
      cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      requestAnimationFrame(step);
    };
    step();
    // hover states
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest('[data-cursor]');
      cursor.classList.remove('is-link','is-cta','is-play');
      if (!el) return;
      const kind = el.getAttribute('data-cursor');
      cursor.classList.add(`is-${kind}`);
    });
  }

  /* ---------------- chalk-dust canvas ---------------- */
  const canvas = $('#dust');
  if (canvas && !reduced) {
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const N = 80;
    const parts = [];
    const colors = ['rgba(244,237,226,0.6)','rgba(255,210,63,0.5)','rgba(255,58,32,0.4)','rgba(255,94,154,0.4)'];

    const resize = () => {
      W = canvas.width  = window.innerWidth  * dpr;
      H = canvas.height = window.innerHeight * dpr;
      canvas.style.width  = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
    };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < N; i++) {
      parts.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: (Math.random() * 1.4 + 0.4) * dpr,
        vx: (Math.random() - 0.5) * 0.15 * dpr,
        vy: (Math.random() * 0.25 + 0.05) * dpr,
        c: colors[(Math.random() * colors.length) | 0],
        life: Math.random() * 240 + 60,
        age: 0,
      });
    }

    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.age++;
        p.x += p.vx;
        p.y += p.vy;
        if (p.y > H || p.age > p.life) {
          p.x = Math.random() * W;
          p.y = -10;
          p.age = 0;
        }
        const alpha = Math.sin((p.age / p.life) * Math.PI);
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(tick);
    };
    tick();
  }

  /* ---------------- language rotator ---------------- */
  const rotator = $('[data-rotator]');
  if (rotator) {
    const rots = $$('.rot', rotator);
    let i = 0;
    rots[0].classList.add('is-in');
    if (!reduced && rots.length > 1) {
      setInterval(() => {
        const cur = rots[i];
        const nxt = rots[(i + 1) % rots.length];
        cur.classList.remove('is-in'); cur.classList.add('is-out');
        setTimeout(() => cur.classList.remove('is-out'), 500);
        nxt.classList.add('is-in');
        i = (i + 1) % rots.length;
      }, 2400);
    }
  }

  /* ---------------- scroll reveals ---------------- */
  const reveals = $$('[data-reveal]');
  const revealNow = (el) => el.classList.add('is-in');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { revealNow(en.target); io.unobserve(en.target); }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px 200px 0px' });
  reveals.forEach((el) => io.observe(el));
  // hard fallback (fires almost immediately) so any snapshot / older env shows content
  requestAnimationFrame(() => requestAnimationFrame(() => {
    reveals.forEach(revealNow);
  }));

  /* ---------------- nav scroll + mobile ---------------- */
  const nav = $('#nav');
  const onScroll = () => {
    if (!nav) return;
    if (window.scrollY > 40) nav.classList.add('is-scrolled');
    else nav.classList.remove('is-scrolled');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const navToggle = $('#navToggle');
  if (navToggle) {
    navToggle.addEventListener('click', () => nav.classList.toggle('is-open'));
    $$('.nav__links a').forEach(a => a.addEventListener('click', () => nav.classList.remove('is-open')));
  }

  /* ---------------- timeline filters ---------------- */
  const filters = $$('.filter');
  const events  = $$('.tl__event');
  filters.forEach((btn) => {
    btn.addEventListener('click', () => {
      filters.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const f = btn.dataset.filter;
      events.forEach((ev) => {
        const lang = ev.dataset.lang;
        const reg  = ev.dataset.reg;
        const match = (f === 'all') || (f === lang) || (f === reg);
        ev.classList.toggle('is-filtered-out', !match);
      });
    });
  });

  /* ---------------- gallery lightbox ---------------- */
  const lb    = $('#lightbox');
  const lbImg = $('#lbImg');
  const lbCap = $('#lbCap');
  const lbCls = $('#lbClose');
  $$('.wall__item').forEach((fig) => {
    fig.addEventListener('click', () => {
      const img = $('img', fig);
      const cap = $('figcaption', fig);
      if (!img || !lb) return;
      lbImg.src = img.src;
      lbImg.alt = img.alt || '';
      lbCap.textContent = cap ? cap.textContent : '';
      lb.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    });
  });
  const closeLb = () => {
    lb.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { lbImg.src = ''; }, 300);
  };
  if (lbCls) lbCls.addEventListener('click', closeLb);
  if (lb) lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLb(); });

  /* ---------------- reels hover play ---------------- */
  $$('.reel').forEach((v) => {
    let played = false;
    const play = () => { v.play().catch(() => {}); };
    const pause = () => { v.pause(); };
    v.addEventListener('mouseenter', play);
    v.addEventListener('mouseleave', () => { v.pause(); v.currentTime = 0; });
    v.addEventListener('click', () => {
      if (v.paused) play(); else pause();
    });
    // autoplay first reel briefly on scroll into view
    const one = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting && !played) { played = true; play(); setTimeout(() => v.pause(), 4000); }
      });
    }, { threshold: 0.6 });
    one.observe(v);
  });

  /* ---------------- parallax polaroids (subtle) ---------------- */
  const polaroids = $$('.polaroid');
  if (polaroids.length && !reduced) {
    window.addEventListener('mousemove', (e) => {
      const cx = (e.clientX / window.innerWidth  - 0.5);
      const cy = (e.clientY / window.innerHeight - 0.5);
      polaroids.forEach((p, i) => {
        const depth = (i + 1) * 6;
        p.style.transform = `translate(${cx * depth}px, ${cy * depth}px) rotate(${p.dataset.rot || (i === 0 ? 4 : i === 1 ? -6 : 8)}deg)`;
      });
    });
  }
};

// Wait for render.js to populate the DOM before wiring interactions.
// Unconditional loader dismissal safety net — runs even if initAnanth never fires
// (e.g. render.js failed to fetch content.json). No matter what, the loader clears
// within 4s so the page is never permanently stuck on "tuning the mic…".
setTimeout(() => {
  const l = document.getElementById('loader');
  if (l) l.classList.add('is-done');
}, 4000);

if (document.querySelector('#nav')?.children.length) {
  initAnanth();
} else {
  document.addEventListener('content:rendered', initAnanth, { once: true });
  // If render.js takes too long or errors, still boot interactions in a degraded mode
  setTimeout(() => {
    if (!document.documentElement.classList.contains('ananth-inited')) {
      initAnanth();
    }
  }, 3000);
}
