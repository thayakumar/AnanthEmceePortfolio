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
  // Loader stays up until user taps/keys anywhere. That first gesture
  // both dismisses the loader AND unlocks audio autoplay (browsers require
  // a user gesture before letting us play unmuted sound).
  const loader = $('#loader');
  let loaderDone = false;
  const dismissLoader = () => {
    if (loaderDone) return;
    loaderDone = true;
    if (loader) loader.classList.add('is-done');
    // fire an event so the music module can pick it up
    document.dispatchEvent(new CustomEvent('loader:dismissed'));
  };
  if (reduced) {
    // Reduced-motion users: skip the interstitial, dismiss immediately
    setTimeout(dismissLoader, 100);
  } else if (loader) {
    const trigger = (e) => { e.stopPropagation(); dismissLoader(); };
    loader.addEventListener('click', trigger);
    loader.addEventListener('touchend', trigger);
    loader.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dismissLoader(); }
    });
  } else {
    dismissLoader();
  }

  /* ---------------- footer year ---------------- */
  const yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();

  /* ---------------- background music ---------------- */
  (() => {
    const music = $('#bgMusic');
    const toggle = $('#musicToggle');
    if (!music || !toggle) return;

    window.bgMusic = music;
    const TARGET_VOL = 0.5;
    music.volume = 0;
    music.muted = true;

    // Hide toggle if the audio file 404s / decode fails
    music.addEventListener('error', () => { toggle.style.display = 'none'; });

    let unlocked = false;
    const fadeIn = () => {
      const start = performance.now();
      const from = music.volume;
      const dur = 1200;
      const step = (now) => {
        const t = Math.min(1, (now - start) / dur);
        music.volume = from + (TARGET_VOL - from) * t;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      music.muted = false;
      music.play().then(() => {
        fadeIn();
        toggle.classList.remove('needs-tap', 'is-muted');
        toggle.classList.add('is-playing');
      }).catch(() => {
        // still blocked — user will need to hit the toggle explicitly
        toggle.classList.add('is-muted');
        unlocked = false;
      });
    };

    // Try muted autoplay on load — many browsers allow this
    music.play().catch(() => {});

    // Primary unlock: user clicks the loader ("tap to enter") — the click is a
    // real gesture and satisfies every browser's autoplay policy.
    document.addEventListener('loader:dismissed', unlock);

    // Fallback: if the loader was auto-dismissed (reduced motion) or the user
    // skipped it, unlock on any subsequent interaction.
    const gestureEvents = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    const onFirst = () => {
      unlock();
      gestureEvents.forEach(e => window.removeEventListener(e, onFirst, true));
    };
    gestureEvents.forEach(e => window.addEventListener(e, onFirst, { capture: true, once: false, passive: true }));

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (music.paused || music.muted) {
        music.muted = false;
        music.play().then(() => {
          fadeIn();
          toggle.classList.remove('is-muted', 'needs-tap');
          toggle.classList.add('is-playing');
          unlocked = true;
        }).catch(() => {});
      } else {
        music.pause();
        toggle.classList.add('is-muted');
        toggle.classList.remove('is-playing');
      }
    });
  })();

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

  /* ---------------- reels ----------------
     Behavior:
      - All reels loop silently whenever the reels section is on-screen.
      - Hover a reel: pause every other reel, unmute the hovered one, duck music.
      - Leave the reel: mute it and resume silent playback of every reel.
      - Section scrolls off-screen: pause all reels (they resume on re-enter).
  */
  const allReels = $$('.reel');
  const reelsWrap = $('.reels');
  let hoveredReel = null;
  let sectionVisible = false;

  const duckMusic = () => {
    if (window.bgMusic && !window.bgMusic.paused && window.bgMusic._preDuckVol == null) {
      window.bgMusic._preDuckVol = window.bgMusic.volume;
      window.bgMusic.volume = 0.08;
    }
  };
  const unduckMusic = () => {
    if (window.bgMusic && window.bgMusic._preDuckVol != null) {
      window.bgMusic.volume = window.bgMusic._preDuckVol;
      window.bgMusic._preDuckVol = null;
    }
  };
  const playSilent = (v) => {
    v.loop = true;
    v.muted = true;
    v.play().catch(() => {});
  };
  const playAllSilent = () => allReels.forEach(playSilent);
  const pauseAllReels = () => allReels.forEach(v => v.pause());

  allReels.forEach((v) => {
    v.loop = true;
    v.muted = true;

    v.addEventListener('mouseenter', () => {
      hoveredReel = v;
      // Pause every other reel while this one plays with sound
      allReels.forEach(other => { if (other !== v) other.pause(); });
      v.muted = false;
      v.volume = 1;
      duckMusic();
      v.play().catch(() => {});
    });
    v.addEventListener('mouseleave', () => {
      hoveredReel = null;
      v.muted = true;
      unduckMusic();
      // Resume silent playback of every reel (only while the section is on screen)
      if (sectionVisible) playAllSilent();
      else v.pause();
    });
    v.addEventListener('click', () => {
      if (v.paused || v.muted) {
        // treat click as hover-equivalent
        v.dispatchEvent(new Event('mouseenter'));
      } else {
        v.dispatchEvent(new Event('mouseleave'));
      }
    });
  });

  if (reelsWrap && allReels.length) {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        sectionVisible = e.isIntersecting;
        if (sectionVisible) {
          // Resume silent playback of every reel that isn't the hovered one
          allReels.forEach(v => { if (v !== hoveredReel) playSilent(v); });
        } else {
          pauseAllReels();
          hoveredReel = null;
          unduckMusic();
        }
      });
    }, { threshold: 0.1 });
    sectionObserver.observe(reelsWrap);
  }

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
// Note: the loader intentionally waits for a user click (required to unlock
// audio autoplay). If render.js errors, initAnanth still runs in degraded mode
// via the content:rendered fallback below, so the click handler is always wired.

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
