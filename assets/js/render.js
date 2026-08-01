/* =========================================================
   ANANTH · render.js
   Hydrates index.html sections from assets/data/content.json.
   Runs synchronously before main.js so that all interactive
   elements exist by the time main.js queries the DOM.
   ========================================================= */
(async () => {
  'use strict';

  const CONTENT_URL = 'assets/data/content.json';
  const THEME_URL   = 'assets/data/theme.json';

  // Apply theme tokens to :root CSS custom properties.
  // Called at load, and can be called again by admin when user edits theme live.
  window.applyTheme = (theme) => {
    if (!theme) return;
    const root = document.documentElement;
    if (theme.colors) {
      for (const key of Object.keys(theme.colors)) {
        const t = theme.colors[key];
        if (t && t.css && t.value) root.style.setProperty(t.css, t.value);
      }
    }
    if (theme.sizes) {
      for (const key of Object.keys(theme.sizes)) {
        const t = theme.sizes[key];
        if (!t || !t.css || t.value == null) continue;
        const tmpl = t.cssTemplate || '{v}px';
        const val = String(tmpl).replaceAll('{v}', String(t.value));
        root.style.setProperty(t.css, val);
      }
    }
  };

  // Try loading theme first — it's small and non-blocking for the rest of the render.
  (async () => {
    try {
      const r = await fetch(THEME_URL, { cache: 'no-store' });
      if (r.ok) window.applyTheme(await r.json());
    } catch (e) { /* theme is optional; site still works with default tokens */ }
  })();

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  // Convert *emphasized* markers to <em> spans (used by hero blurb + about title/paragraphs)
  const inline = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Pretty newlines in meta labels: split on \n
  const nlToBr = (s) => esc(s).replace(/\n/g, '<br/>');

  let data;
  try {
    const res = await fetch(CONTENT_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e) {
    console.error('[render] content.json failed to load — booting site in degraded mode:', e);
    // Still fire the event so main.js can dismiss the loader and wire up whatever it can
    document.dispatchEvent(new CustomEvent('content:rendered', { detail: { error: e } }));
    // Also surface the error visibly so it isn't silent
    const loader = document.getElementById('loader');
    if (loader) {
      const sub = loader.querySelector('.loader__sub');
      if (sub) sub.textContent = 'content.json failed — check network / path';
    }
    return;
  }

  /* -------- meta / <title> / <meta description> -------- */
  document.querySelectorAll('[data-hydrate]').forEach((el) => {
    const path = el.dataset.hydrate;
    const val = path.split('.').reduce((o,k) => (o||{})[k], data);
    if (val == null) return;
    if (el.tagName === 'META') el.setAttribute('content', val);
    else el.textContent = val;
  });

  /* -------- section renderers -------- */
  const renderers = {

    nav(d) {
      const n = d.nav;
      const links = n.links.map(l =>
        `<a href="${esc(l.href)}" data-cursor="link"><span>${esc(l.num)}</span> ${esc(l.label)}</a>`
      ).join('');
      return `
        <a href="#top" class="nav__brand" data-cursor="link">
          <span class="nav__chalk">${esc(n.brand_short)}</span>
          <span class="nav__word">${esc(n.brand_word)}</span>
        </a>
        <nav class="nav__links" aria-label="primary">
          ${links}
          <a href="${esc(n.cta.href)}" class="nav__cta" data-cursor="link">${esc(n.cta.label)}</a>
        </nav>
        <button class="nav__toggle" id="navToggle" aria-label="menu">
          <span></span><span></span><span></span>
        </button>
      `;
    },

    hero(d) {
      const h = d.hero;
      const letters = [...h.name].map((c,i) => `<span class="letter" style="--i:${i}">${esc(c)}</span>`).join('');
      const rot = h.rotator.map((r,i) => `<span class="rot ${esc(r.lang)}${i===0?' is-in':''}">${esc(r.text)}</span>`).join('');
      const stats = h.meta_stats.map(s =>
        `<div><span class="meta__num" data-count="${esc(s.num)}">${esc(s.num)}</span><span class="meta__lbl">${nlToBr(s.label)}</span></div>`
      ).join('');
      const polaroids = h.polaroids.map((p,i) => {
        const tapeCls = p.tape ? `tape--${esc(p.tape)}` : 'tape--top';
        const src = esc(p.image);
        // eager+sync so above-the-fold images never depend on a scroll/lazy trigger
        return `
          <figure class="polaroid polaroid--${i+1}">
            <img src="${src}" alt="${esc(p.alt)}" loading="eager" decoding="sync" fetchpriority="high" onerror="this.parentNode.classList.add('is-broken')"/>
            <figcaption>${esc(p.caption)}</figcaption>
            <span class="tape ${tapeCls}"></span>
          </figure>`;
      }).join('');
      return `
        <div class="hero__grid"></div>
        <div class="hero__scribbles" aria-hidden="true">
          <svg viewBox="0 0 200 60" class="scribble scribble--1"><path d="M5 40 Q 30 5, 60 30 T 120 25 T 195 35" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <svg viewBox="0 0 60 60"  class="scribble scribble--star"><path d="M30 4 L36 22 L55 22 L40 34 L46 54 L30 42 L14 54 L20 34 L5 22 L24 22 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
          <svg viewBox="0 0 60 60"  class="scribble scribble--spark"><path d="M30 4 V56 M4 30 H56 M12 12 L48 48 M48 12 L12 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <svg viewBox="0 0 120 40" class="scribble scribble--underline"><path d="M4 30 Q 40 10, 60 25 T 116 20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
        </div>
        <div class="hero__stage">
          <div class="hero__eyebrow">
            <span class="eyebrow-dot"></span>
            <span>${esc(h.eyebrow)}</span>
          </div>
          <h1 class="hero__title" aria-label="${esc(h.name)}">
            ${letters}
            <span class="hero__title-stroke" aria-hidden="true"></span>
          </h1>
          <div class="hero__sub">
            <span class="hero__lead">${esc(h.lead)} </span>
            <span class="hero__rotator" data-rotator>${rot}</span>
          </div>
          <p class="hero__blurb">${inline(h.blurb)}</p>
          <div class="hero__actions">
            <a href="${esc(h.primary_cta.href)}" class="btn btn--primary" data-cursor="cta">
              <span>${esc(h.primary_cta.label)}</span>
              <svg viewBox="0 0 24 24"><path d="M4 12h16m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </a>
            <a href="${esc(h.secondary_cta.href)}" class="btn btn--ghost" data-cursor="link">${esc(h.secondary_cta.label)}</a>
          </div>
          <div class="hero__meta">${stats}</div>
        </div>
        <div class="hero__polaroids">${polaroids}</div>
        <div class="hero__scroll" aria-hidden="true">
          <span>scroll</span>
          <span class="hero__scroll-line"></span>
        </div>
      `;
    },

    marquee(d) {
      const items = d.marquee.map(t => `<span>${esc(t)}</span>`).join('');
      // duplicate for seamless loop
      return `<div class="marquee__track">${items}${items}${items}</div>`;
    },

    about(d) {
      const a = d.about;
      const paragraphs = a.paragraphs.map(p => `<p data-reveal>${inline(p)}</p>`).join('');
      const chips = a.chips.map(c => `<span class="chip"><b>${esc(c.code)}</b> ${esc(c.label)}</span>`).join('');
      const stats = a.stats.map(s => `<li><b>${esc(s.b)}</b><span>${esc(s.span)}</span></li>`).join('');
      return `
        <div class="section-num" data-reveal>${esc(a.num)} <span>— ${esc(a.num_label)}</span></div>
        <div class="about__grid">
          <div class="about__col about__col--copy">
            <h2 class="section-title" data-reveal>
              ${inline(a.title_line1)}<br/>
              <span class="ink">${esc(a.title_line2_ink)}</span>
            </h2>
            ${paragraphs}
            <p data-reveal class="about__quote">
              <span class="quote-mark">“</span>${esc(a.quote.text)}<span class="quote-mark">”</span>
              <span class="about__quote-src">— ${esc(a.quote.source)}</span>
            </p>
            <div class="chips" data-reveal>${chips}</div>
          </div>
          <div class="about__col about__col--visual">
            <div class="about__portrait" data-reveal>
              <img src="${esc(a.portrait.image)}" alt="${esc(a.portrait.alt)}" loading="eager" decoding="async" onerror="this.parentNode.classList.add('is-broken')"/>
              <svg class="about__frame" viewBox="0 0 400 500" preserveAspectRatio="none" aria-hidden="true">
                <path d="M8 12 Q 200 4, 392 10 Q 396 250, 388 490 Q 200 496, 12 488 Q 4 250, 8 12 Z" fill="none" stroke="currentColor" stroke-width="2.5"/>
              </svg>
              <span class="about__portrait-tag">${esc(a.portrait.tag)}</span>
            </div>
            <ul class="about__stats" data-reveal>${stats}</ul>
          </div>
        </div>
      `;
    },

    stages(d) {
      const s = d.stages;
      // group events by year (preserve their input order for stability)
      const grouped = [];
      let lastYear = null;
      s.events.forEach(ev => {
        if (ev.year !== lastYear) {
          grouped.push({ year: ev.year, events: [] });
          lastYear = ev.year;
        }
        grouped[grouped.length - 1].events.push(ev);
      });
      const timeline = grouped.map(g => {
        const yearRow = `<li class="tl__year"><span>${esc(g.year)}</span></li>`;
        const evs = g.events.map(ev => {
          const lang = esc(ev.lang || '');
          const reg = esc(ev.register || '');
          const langTagCls = 'tag--' + lang.toLowerCase();
          const regTagCls  = 'tag--' + reg.toLowerCase();
          return `
            <li class="tl__event" data-lang="${lang}" data-reg="${reg}">
              <span class="tl__dot"></span>
              <div class="tl__body">
                <div class="tl__tags">
                  <span class="tag ${langTagCls}">${lang}</span>
                  <span class="tag ${regTagCls}">${reg}</span>
                </div>
                <h3>${esc(ev.title)}</h3>
                <p>${esc(ev.desc)}</p>
              </div>
            </li>`;
        }).join('');
        return yearRow + evs;
      }).join('');
      const keypeople = s.keypeople.map(k => `<li><b>${esc(k.name)}</b><span>${esc(k.role)}</span></li>`).join('');
      return `
        <div class="section-num" data-reveal>${esc(s.num)} <span>— ${esc(s.num_label)}</span></div>
        <h2 class="section-title" data-reveal>
          ${esc(s.title_line1)}<br/>
          <span class="ink">${esc(s.title_line2_ink)}</span>
        </h2>
        <p class="section-lede" data-reveal>${s.lede}</p>
        <div class="filters" data-reveal>
          <button class="filter is-active" data-filter="all"><span>all</span></button>
          <button class="filter" data-filter="EN"><span>English</span></button>
          <button class="filter" data-filter="BM"><span>Malay</span></button>
          <button class="filter" data-filter="TA"><span>Tamil</span></button>
          <button class="filter" data-filter="formal"><span>Formal</span></button>
          <button class="filter" data-filter="informal"><span>Informal</span></button>
        </div>
        <ol class="timeline" data-reveal>${timeline}</ol>
        <div class="keypeople" data-reveal>
          <h3 class="section-mini">${esc(s.keypeople_title)}</h3>
          <ul>${keypeople}</ul>
        </div>
      `;
    },

    clients(d) {
      // repeat sequence for seamless marquee
      const seq = d.clients.map(c => `<span>${esc(c)}</span><span class="dot">✦</span>`).join('');
      return `
        <div class="clients__marquee">
          <div class="clients__track">${seq}${seq}</div>
        </div>
      `;
    },

    gallery(d) {
      const g = d.gallery;
      const items = g.items.map(it => {
        const spanCls = it.span === 'tall'  ? ' wall__item--tall'
                      : it.span === 'wide'  ? ' wall__item--wide'
                      : '';
        return `
          <figure class="wall__item${spanCls}" data-reveal>
            <img src="${esc(it.image)}" alt="${esc(it.alt)}" loading="lazy"/>
            <figcaption><b>${esc(it.title)}</b><span>${esc(it.subtitle)}</span></figcaption>
          </figure>`;
      }).join('');
      const reels = d.reels.videos.map(v =>
        `<video class="reel" src="${esc(v)}" muted loop playsinline preload="metadata" data-cursor="play"></video>`
      ).join('');
      return `
        <div class="section-num" data-reveal>${esc(g.num)} <span>— ${esc(g.num_label)}</span></div>
        <h2 class="section-title" data-reveal>
          ${esc(g.title_line1)}<br/>
          <span class="ink">${esc(g.title_line2_ink)}</span>
        </h2>
        <p class="section-lede" data-reveal>${esc(g.lede)}</p>
        <div class="wall">${items}</div>
        <div class="reels" data-reveal>
          <h3 class="section-mini">${esc(d.reels.title)}</h3>
          <div class="reels__row">${reels}</div>
          <span class="reels__hint">${esc(d.reels.hint)}</span>
        </div>
      `;
    },

    voices(d) {
      const v = d.voices;
      const items = v.items.map((q,i) =>
        `<blockquote class="voice v${i+1}" data-reveal>
           <p><span class="qm">“</span>${esc(q.quote)}<span class="qm">”</span></p>
           <cite>— ${esc(q.cite)}</cite>
         </blockquote>`
      ).join('');
      return `
        <div class="section-num" data-reveal>${esc(v.num)} <span>— ${esc(v.num_label)}</span></div>
        <h2 class="section-title" data-reveal>
          ${esc(v.title_line1)}<br/>
          <span class="ink">${esc(v.title_line2_ink)}</span>
        </h2>
        <div class="voice-grid">${items}</div>
      `;
    },

    book(d) {
      const b = d.book;
      const actions = b.actions.map(a => {
        const cls = a.type === 'primary' ? 'btn btn--primary btn--big' : 'btn btn--ghost btn--big';
        const arrow = a.type === 'primary' ? `<svg viewBox="0 0 24 24"><path d="M4 12h16m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : '';
        return `<a href="${esc(a.href)}" class="${cls}" data-cursor="${a.type === 'primary' ? 'cta' : 'link'}"><span>${esc(a.label)}</span>${arrow}</a>`;
      }).join('');
      const facts = b.facts.map(f => `<li><b>${esc(f.b)}</b> ${esc(f.text)}</li>`).join('');
      return `
        <div class="book__inner">
          <h2 class="book__title" data-reveal>
            ${esc(b.title_line1)}<br/>
            <span class="ink">${esc(b.title_line2_ink)}</span>
          </h2>
          <p class="book__lede" data-reveal>${esc(b.lede)}</p>
          <div class="book__actions" data-reveal>${actions}</div>
          <ul class="book__facts" data-reveal>${facts}</ul>
        </div>
      `;
    },

    footer(d) {
      const yr = new Date().getFullYear();
      return `
        <div class="foot__row">
          <span class="foot__sig">${esc(d.meta.footer_signature)}</span>
          <span class="foot__year">© <span id="yr">${yr}</span></span>
        </div>
        <div class="foot__row foot__row--small">
          <span>${esc(d.meta.footer_tag)}</span>
          <a href="#top" data-cursor="link">back to top ↑</a>
        </div>
      `;
    },
  };

  // Render each section
  document.querySelectorAll('[data-render]').forEach((el) => {
    const key = el.dataset.render;
    const fn = renderers[key];
    if (fn) el.innerHTML = fn(data);
  });

  // Dispatch a signal so main.js knows content is live
  document.dispatchEvent(new CustomEvent('content:rendered', { detail: { data } }));
})();
