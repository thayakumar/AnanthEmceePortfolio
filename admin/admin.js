/* =========================================================
   Ananth · admin.js
   - Load & edit content.json in-memory
   - Section forms (schema-driven)
   - Drag-and-drop reorder for lists
   - File upload (photos + videos)
   - Confirm & Publish → server generates commit + push
   ========================================================= */
(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const state = {
    data: null,          // canonical content.json
    section: 'hero',
    uploadedThisSession: [], // relative paths of new files this session
    dirty: false,
  };

  // ============================================================
  //   API
  // ============================================================
  const api = {
    async getData() { const r = await fetch('/api/data', { cache: 'no-store' }); return r.json(); },
    async saveData(data) {
      const r = await fetch('/api/data', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
      return r.json();
    },
    async status() { const r = await fetch('/api/status', { cache: 'no-store' }); return r.json(); },
    async history() { const r = await fetch('/api/history', { cache: 'no-store' }); return r.json(); },
    async upload(files) {
      const fd = new FormData();
      for (const f of files) fd.append('file', f);
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      return r.json();
    },
    async publish(data, uploaded, note) {
      const r = await fetch('/api/publish', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ data, uploaded, note })
      });
      return r.json();
    },
  };

  // ============================================================
  //   Toast
  // ============================================================
  const toast = (msg, kind = '', ms = 3800) => {
    const t = $('#toast');
    t.className = 'toast is-visible ' + (kind ? 'is-' + kind : '');
    t.innerHTML = msg;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('is-visible'), ms);
  };

  // ============================================================
  //   Field builders
  // ============================================================
  const fld = {
    text(label, path, opts = {}) {
      const val = getPath(state.data, path) ?? '';
      const hint = opts.hint ? `<div class="field__hint">${escape(opts.hint)}</div>` : '';
      return `<div class="field">
        <label class="field__label">${escape(label)}</label>
        <input class="input" type="text" data-bind="${path}" value="${escapeAttr(val)}" ${opts.placeholder?`placeholder="${escapeAttr(opts.placeholder)}"`:''} />
        ${hint}
      </div>`;
    },
    textarea(label, path, opts = {}) {
      const val = getPath(state.data, path) ?? '';
      const hint = opts.hint ? `<div class="field__hint">${escape(opts.hint)}</div>` : '';
      return `<div class="field">
        <label class="field__label">${escape(label)}</label>
        <textarea class="textarea" data-bind="${path}" rows="${opts.rows||3}">${escape(val)}</textarea>
        ${hint}
      </div>`;
    },
    select(label, path, options) {
      const val = getPath(state.data, path) ?? '';
      const opts = options.map(o => `<option value="${escapeAttr(o.value)}" ${o.value===val?'selected':''}>${escape(o.label)}</option>`).join('');
      return `<div class="field">
        <label class="field__label">${escape(label)}</label>
        <select class="input select" data-bind="${path}">${opts}</select>
      </div>`;
    },
    pickImage(label, path) {
      const val = getPath(state.data, path) ?? '';
      return `<div class="field">
        <label class="field__label">${escape(label)}</label>
        <div class="pick-image">
          <img class="pick-image__thumb" src="${val ? '/'+escapeAttr(val) : ''}" alt="" onerror="this.style.background='#fee2e2'"/>
          <input class="input pick-image__input" type="text" data-bind="${path}" value="${escapeAttr(val)}" placeholder="assets/images/xxx.jpg"/>
        </div>
        <div class="field__hint">drop a photo into the upload zone below, then paste its path here (or use the picker in the item's file input)</div>
      </div>`;
    },
    file(label, onFiles) {
      return `<div class="field">
        <label class="field__label">${escape(label)}</label>
        <div class="dropzone" data-drop>
          <strong>Drop photos / videos here</strong>
          <div class="dropzone__hint">or click to pick · they'll be resized (max 1600px) &amp; saved to assets/</div>
          <input type="file" hidden multiple accept="image/*,video/mp4,video/quicktime,video/webm" data-file-input/>
        </div>
      </div>`;
    },
  };

  // ============================================================
  //   Section renderers
  // ============================================================
  const sections = {

    // ---------- HERO ----------
    hero() {
      const h = state.data.hero;
      return `
        <div class="section-head">
          <h2>Hero</h2>
          <span class="sub">the first screen · big name + polaroids</span>
        </div>

        ${fld.text('Eyebrow (small label above title)', 'hero.eyebrow')}
        ${fld.text('Display name (rendered letter-by-letter)', 'hero.name', { hint: 'usually your first name in caps. keep it short.' })}
        ${fld.text('Lead phrase (before the rotating tagline)', 'hero.lead')}

        ${listBlock('Rotating tagline (cycles through languages)', 'hero.rotator', {
           itemFields: (it, i) => `
             ${fld.text('Text', `hero.rotator.${i}.text`)}
             ${fld.select('Language', `hero.rotator.${i}.lang`, [
               { value:'en', label:'English' },
               { value:'bm', label:'Bahasa Malaysia' },
               { value:'ta', label:'Tamil' },
             ])}`,
           addLabel: '+ add rotator line',
           newItem: () => ({ lang: 'en', text: '' }),
        })}

        ${fld.textarea('Blurb paragraph', 'hero.blurb', { rows: 4, hint: 'wrap words in *asterisks* to style them like a marker highlight' })}

        <div class="grid-2">
          ${fld.text('Primary CTA · label', 'hero.primary_cta.label')}
          ${fld.text('Primary CTA · link',  'hero.primary_cta.href')}
          ${fld.text('Secondary CTA · label', 'hero.secondary_cta.label')}
          ${fld.text('Secondary CTA · link',  'hero.secondary_cta.href')}
        </div>

        ${listBlock('Meta stats (row of numbers under blurb)', 'hero.meta_stats', {
           itemFields: (it, i) => `
             <div class="grid-2">
               ${fld.text('Number', `hero.meta_stats.${i}.num`)}
               ${fld.text('Label (\\n makes a line break)', `hero.meta_stats.${i}.label`)}
             </div>`,
           addLabel: '+ add stat',
           newItem: () => ({ num: '00', label: 'new stat\nsub-line' }),
        })}

        ${listBlock('Hero polaroids (photos in the right column)', 'hero.polaroids', {
           itemFields: (it, i) => `
             ${fld.pickImage('Photo path', `hero.polaroids.${i}.image`)}
             ${fld.text('Alt text', `hero.polaroids.${i}.alt`)}
             ${fld.text('Caption', `hero.polaroids.${i}.caption`)}
             ${fld.select('Tape position', `hero.polaroids.${i}.tape`, [
               { value:'top', label:'top' }, { value:'left', label:'left' }, { value:'right', label:'right' }
             ])}`,
           addLabel: '+ add polaroid',
           newItem: () => ({ image: '', alt: '', caption: '', tape: 'top' }),
           thumb: (it) => it.image,
        })}

        ${fld.file('Upload new photos → get their paths above')}
      `;
    },

    // ---------- ABOUT ----------
    about() {
      const a = state.data.about;
      return `
        <div class="section-head"><h2>About</h2><span class="sub">the voice · introduction + portrait</span></div>

        <div class="grid-2">
          ${fld.text('Section number', 'about.num')}
          ${fld.text('Section number sub-label', 'about.num_label')}
        </div>
        ${fld.text('Title · line 1 (*em* for italic-hand)', 'about.title_line1')}
        ${fld.text('Title · line 2 (ink accent)', 'about.title_line2_ink')}

        ${listBlock('Paragraphs', 'about.paragraphs', {
           isPrimitive: true,
           itemFields: (it, i) => fld.textarea('Text (*em* for hand-highlight)', `about.paragraphs.${i}`, { rows: 4 }),
           addLabel: '+ add paragraph',
           newItem: () => 'A new paragraph.',
        })}

        <div class="grid-2">
          ${fld.textarea('Quote text', 'about.quote.text', { rows: 3 })}
          ${fld.text('Quote source', 'about.quote.source')}
        </div>

        ${listBlock('Language chips', 'about.chips', {
           itemFields: (it, i) => `
             <div class="grid-2">
               ${fld.text('Code (2 letters)', `about.chips.${i}.code`)}
               ${fld.text('Label', `about.chips.${i}.label`)}
             </div>`,
           addLabel: '+ add chip',
           newItem: () => ({ code: 'XX', label: 'New language' }),
        })}

        <hr style="margin: 24px 0; border: 0; border-top: 1px solid var(--line);"/>

        <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 12px;">Portrait</h3>
        ${fld.pickImage('Photo', 'about.portrait.image')}
        ${fld.text('Alt text', 'about.portrait.alt')}
        ${fld.text('Overlay tag (small red badge)', 'about.portrait.tag')}

        ${listBlock('Sidebar facts', 'about.stats', {
           itemFields: (it, i) => `
             <div class="grid-2">
               ${fld.text('Label', `about.stats.${i}.b`)}
               ${fld.text('Value', `about.stats.${i}.span`)}
             </div>`,
           addLabel: '+ add fact',
           newItem: () => ({ b: 'Label', span: 'value' }),
        })}
      `;
    },

    // ---------- STAGES ----------
    stages() {
      const s = state.data.stages;
      return `
        <div class="section-head"><h2>Stages / Events</h2><span class="sub">the timeline of every event hosted</span></div>

        <div class="grid-2">
          ${fld.text('Section number', 'stages.num')}
          ${fld.text('Section number sub-label', 'stages.num_label')}
        </div>
        ${fld.text('Title · line 1', 'stages.title_line1')}
        ${fld.text('Title · line 2 (ink)', 'stages.title_line2_ink')}
        ${fld.textarea('Lede (allows HTML like <b>)', 'stages.lede', { rows: 2 })}

        ${listBlock('Events (drag to reorder)', 'stages.events', {
           itemFields: (it, i) => `
             <div class="grid-3">
               ${fld.text('Year', `stages.events.${i}.year`)}
               ${fld.select('Language', `stages.events.${i}.lang`, [
                 { value:'EN', label:'English' }, { value:'BM', label:'Malay' }, { value:'TA', label:'Tamil' }
               ])}
               ${fld.select('Register', `stages.events.${i}.register`, [
                 { value:'formal', label:'Formal' }, { value:'informal', label:'Informal' }
               ])}
             </div>
             ${fld.text('Event title', `stages.events.${i}.title`)}
             ${fld.textarea('Description', `stages.events.${i}.desc`, { rows: 2 })}`,
           addLabel: '+ add event',
           newItem: () => ({ year: String(new Date().getFullYear()), title: 'New event', desc: '', lang: 'EN', register: 'formal' }),
        })}

        <hr style="margin: 24px 0; border: 0; border-top: 1px solid var(--line);"/>

        ${fld.text('Key people section title', 'stages.keypeople_title')}
        ${listBlock('Key people met', 'stages.keypeople', {
           itemFields: (it, i) => `
             <div class="grid-2">
               ${fld.text('Name', `stages.keypeople.${i}.name`)}
               ${fld.text('Role',  `stages.keypeople.${i}.role`)}
             </div>`,
           addLabel: '+ add person',
           newItem: () => ({ name: 'Name', role: 'Role' }),
        })}
      `;
    },

    // ---------- CLIENTS ----------
    clients() {
      return `
        <div class="section-head"><h2>Clients</h2><span class="sub">names that scroll across the coloured band</span></div>
        ${listBlock('Client / organisation names', 'clients', {
           isPrimitive: true,
           itemFields: (it, i) => fld.text('Name', `clients.${i}`),
           addLabel: '+ add client',
           newItem: () => 'New Client',
        })}
      `;
    },

    // ---------- GALLERY ----------
    gallery() {
      const g = state.data.gallery;
      return `
        <div class="section-head"><h2>Gallery</h2><span class="sub">the wall of photos · click to lightbox</span></div>
        <div class="grid-2">
          ${fld.text('Section number', 'gallery.num')}
          ${fld.text('Section number sub-label', 'gallery.num_label')}
        </div>
        ${fld.text('Title · line 1', 'gallery.title_line1')}
        ${fld.text('Title · line 2 (ink)', 'gallery.title_line2_ink')}
        ${fld.textarea('Lede', 'gallery.lede', { rows: 2 })}

        ${listBlock('Photos (drag to reorder)', 'gallery.items', {
           itemFields: (it, i) => `
             ${fld.pickImage('Photo path', `gallery.items.${i}.image`)}
             <div class="grid-2">
               ${fld.text('Title (bold caption)', `gallery.items.${i}.title`)}
               ${fld.text('Subtitle', `gallery.items.${i}.subtitle`)}
             </div>
             ${fld.text('Alt text', `gallery.items.${i}.alt`)}
             ${fld.select('Span (grid size)', `gallery.items.${i}.span`, [
               { value:'normal', label:'Normal (1×1)' },
               { value:'tall',   label:'Tall (1×2)' },
               { value:'wide',   label:'Wide (2×1)' },
             ])}`,
           addLabel: '+ add photo',
           newItem: () => ({ image: '', alt: '', title: '', subtitle: '', span: 'normal' }),
           thumb: (it) => it.image,
        })}

        ${fld.file('Upload new photos')}
      `;
    },

    // ---------- REELS ----------
    reels() {
      return `
        <div class="section-head"><h2>Reels</h2><span class="sub">short videos under the photo wall</span></div>

        <div class="grid-2">
          ${fld.text('Row title (e.g. "↳ short reels")', 'reels.title')}
          ${fld.text('Hint text below the row', 'reels.hint')}
        </div>

        ${listBlock('Video paths (drag to reorder)', 'reels.videos', {
           isPrimitive: true,
           itemFields: (it, i) => fld.text('Video path', `reels.videos.${i}`),
           addLabel: '+ add reel',
           newItem: () => 'assets/videos/new.mp4',
           video: (it) => it,
        })}

        ${fld.file('Upload video files (MP4 preferred, MOV/WebM ok)')}
      `;
    },

    // ---------- VOICES ----------
    voices() {
      return `
        <div class="section-head"><h2>Voices</h2><span class="sub">what people say after the event</span></div>
        <div class="grid-2">
          ${fld.text('Section number', 'voices.num')}
          ${fld.text('Section number sub-label', 'voices.num_label')}
        </div>
        ${fld.text('Title · line 1', 'voices.title_line1')}
        ${fld.text('Title · line 2 (ink)', 'voices.title_line2_ink')}

        ${listBlock('Quotes', 'voices.items', {
           itemFields: (it, i) => `
             ${fld.textarea('Quote', `voices.items.${i}.quote`, { rows: 2 })}
             ${fld.text('Source (shown after em-dash)', `voices.items.${i}.cite`)}`,
           addLabel: '+ add quote',
           newItem: () => ({ quote: 'New quote.', cite: 'attribution' }),
        })}
      `;
    },

    // ---------- BOOK ----------
    book() {
      return `
        <div class="section-head"><h2>Booking</h2><span class="sub">the CTA at the bottom of the page</span></div>
        ${fld.text('Title · line 1', 'book.title_line1')}
        ${fld.text('Title · line 2 (ink)', 'book.title_line2_ink')}
        ${fld.textarea('Lede', 'book.lede', { rows: 3 })}

        ${listBlock('Action buttons', 'book.actions', {
           itemFields: (it, i) => `
             <div class="grid-2">
               ${fld.text('Button label', `book.actions.${i}.label`)}
               ${fld.select('Style', `book.actions.${i}.type`, [
                 { value:'primary', label:'Primary (red)' },
                 { value:'ghost', label:'Ghost (outline)' },
               ])}
             </div>
             ${fld.text('Link (mailto:, https:, tel:)', `book.actions.${i}.href`)}`,
           addLabel: '+ add action',
           newItem: () => ({ label: 'button', href: '#', type: 'ghost' }),
        })}

        ${listBlock('Facts', 'book.facts', {
           itemFields: (it, i) => `
             <div class="grid-2">
               ${fld.text('Label', `book.facts.${i}.b`)}
               ${fld.text('Value', `book.facts.${i}.text`)}
             </div>`,
           addLabel: '+ add fact',
           newItem: () => ({ b: 'Label', text: 'value' }),
        })}
      `;
    },

    // ---------- NAV ----------
    nav() {
      return `
        <div class="section-head"><h2>Navigation</h2><span class="sub">links across the top of the site</span></div>
        <div class="grid-2">
          ${fld.text('Brand short (small tag near logo)', 'nav.brand_short')}
          ${fld.text('Brand word', 'nav.brand_word')}
        </div>
        ${listBlock('Nav links (drag to reorder)', 'nav.links', {
           itemFields: (it, i) => `
             <div class="grid-3">
               ${fld.text('Number', `nav.links.${i}.num`)}
               ${fld.text('Label', `nav.links.${i}.label`)}
               ${fld.text('Anchor / URL', `nav.links.${i}.href`)}
             </div>`,
           addLabel: '+ add nav link',
           newItem: () => ({ num: '00', label: 'Link', href: '#' }),
        })}
        <div class="grid-2">
          ${fld.text('CTA label', 'nav.cta.label')}
          ${fld.text('CTA link',  'nav.cta.href')}
        </div>
      `;
    },

    // ---------- MARQUEE ----------
    marquee() {
      return `
        <div class="section-head"><h2>Marquee</h2><span class="sub">the moving band under the hero</span></div>
        ${listBlock('Marquee lines (repeat 3× for seamless scroll)', 'marquee', {
           isPrimitive: true,
           itemFields: (it, i) => fld.text('Text', `marquee.${i}`),
           addLabel: '+ add line',
           newItem: () => 'new phrase ·',
        })}
      `;
    },

    // ---------- META ----------
    meta() {
      return `
        <div class="section-head"><h2>Meta / SEO</h2><span class="sub">page title, description, footer</span></div>
        ${fld.text('Site title (browser tab)', 'meta.site_title')}
        ${fld.textarea('Meta description', 'meta.description', { rows: 3, hint: 'shown by search engines under the title' })}
        <hr style="margin:24px 0; border:0; border-top:1px solid var(--line);"/>
        ${fld.text('Footer signature', 'meta.footer_signature')}
        ${fld.text('Footer tag line', 'meta.footer_tag')}
      `;
    },
  };

  // ============================================================
  //   List block helper — renders a reorderable list of items
  // ============================================================
  function listBlock(title, path, cfg) {
    const arr = getPath(state.data, path) || [];
    const items = arr.map((it, i) => {
      let thumbEl = '';
      if (cfg.thumb) {
        const src = cfg.thumb(it);
        if (src) thumbEl = `<img class="item__thumb" src="/${escapeAttr(src)}" alt="" onerror="this.style.background='#fee2e2'"/>`;
      } else if (cfg.video) {
        const src = cfg.video(it);
        if (src) thumbEl = `<div class="item__preview"><video src="/${escapeAttr(src)}" muted preload="metadata"></video></div>`;
      }
      return `
        <div class="item" draggable="true" data-list="${escapeAttr(path)}" data-index="${i}">
          <div class="item__handle" title="drag to reorder">⋮⋮</div>
          <div class="item__body">
            ${thumbEl}
            ${cfg.itemFields(it, i)}
          </div>
          <div class="item__actions">
            <button class="icon-up" title="move up" data-move="up">↑</button>
            <button class="icon-down" title="move down" data-move="down">↓</button>
            <button class="icon-del" title="delete" data-del="1">✕</button>
          </div>
        </div>
      `;
    }).join('') || `<div class="empty">no items yet — click below to add one.</div>`;

    return `
      <div class="list" data-list-root="${escapeAttr(path)}">
        <div class="list__head">
          <span class="list__title">${escape(title)}</span>
          <span class="muted" style="font-size:12px">${arr.length} item${arr.length===1?'':'s'}</span>
        </div>
        <div data-list-items="${escapeAttr(path)}">${items}</div>
        <button class="add-btn" data-add="${escapeAttr(path)}">${escape(cfg.addLabel)}</button>
      </div>
    `;
  }

  // ============================================================
  //   Path helpers
  // ============================================================
  function getPath(obj, dotted) {
    if (!dotted) return obj;
    return dotted.split('.').reduce((o, k) => {
      if (o == null) return undefined;
      if (Array.isArray(o)) return o[Number(k)];
      return o[k];
    }, obj);
  }
  function setPath(obj, dotted, val) {
    const keys = dotted.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      const nextKey = keys[i+1];
      const isArrNext = /^\d+$/.test(nextKey);
      if (Array.isArray(cur)) {
        const idx = Number(k);
        if (cur[idx] == null) cur[idx] = isArrNext ? [] : {};
        cur = cur[idx];
      } else {
        if (cur[k] == null) cur[k] = isArrNext ? [] : {};
        cur = cur[k];
      }
    }
    const last = keys[keys.length - 1];
    if (Array.isArray(cur)) cur[Number(last)] = val;
    else cur[last] = val;
  }
  function delPath(obj, dotted) {
    const keys = dotted.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      cur = Array.isArray(cur) ? cur[Number(keys[i])] : cur[keys[i]];
      if (cur == null) return;
    }
    const last = keys[keys.length - 1];
    if (Array.isArray(cur)) cur.splice(Number(last), 1);
    else delete cur[last];
  }

  // ============================================================
  //   Escape helpers
  // ============================================================
  const escape    = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const escapeAttr = escape;

  // ============================================================
  //   Render current section
  // ============================================================
  function renderSection() {
    const sec = state.section;
    const fn = sections[sec];
    $('#form').innerHTML = fn ? fn() : `<div class="empty">unknown section: ${sec}</div>`;
    wireForm();
  }

  // Bind inputs & buttons in the form to state + reorder + upload
  function wireForm() {
    // input change → mutate state
    $$('#form [data-bind]').forEach(el => {
      const path = el.dataset.bind;
      el.addEventListener('input', () => {
        let v = el.value;
        setPath(state.data, path, v);
        state.dirty = true;
        // If we changed the image path of a list item, refresh its thumbnail
        const item = el.closest('.item');
        if (item && (path.endsWith('.image') || /reels\.videos\.\d+$/.test(path))) {
          const thumb = item.querySelector('.item__thumb');
          const vid = item.querySelector('.item__preview video');
          if (thumb) thumb.src = v ? '/' + v : '';
          if (vid) vid.src = v ? '/' + v : '';
        }
      });
      // For textareas: handle \n encoding for the hero meta stats
    });

    // add / delete / move
    $$('#form [data-add]').forEach(btn => {
      btn.addEventListener('click', () => {
        const path = btn.dataset.add;
        const arr = getPath(state.data, path) || [];
        // Figure out newItem() from section config — we stored none, so inline defaults per path
        const proto = protoFor(path);
        arr.push(proto());
        setPath(state.data, path, arr);
        state.dirty = true;
        renderSection();
      });
    });
    $$('#form [data-del]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const item = btn.closest('.item');
        if (!item) return;
        if (!confirm('Delete this item?')) return;
        const listPath = item.dataset.list;
        const idx = Number(item.dataset.index);
        const arr = getPath(state.data, listPath) || [];
        arr.splice(idx, 1);
        state.dirty = true;
        renderSection();
      });
    });
    $$('#form [data-move]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.item');
        if (!item) return;
        const dir = btn.dataset.move;
        const listPath = item.dataset.list;
        const idx = Number(item.dataset.index);
        const arr = getPath(state.data, listPath) || [];
        const to = dir === 'up' ? idx - 1 : idx + 1;
        if (to < 0 || to >= arr.length) return;
        [arr[idx], arr[to]] = [arr[to], arr[idx]];
        state.dirty = true;
        renderSection();
      });
    });

    // Drag-and-drop
    let dragEl = null;
    $$('#form .item').forEach((item) => {
      item.addEventListener('dragstart', (e) => {
        dragEl = item;
        item.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('is-dragging');
        $$('#form .is-drag-over').forEach(el => el.classList.remove('is-drag-over'));
      });
      item.addEventListener('dragover', (e) => {
        if (!dragEl || dragEl === item) return;
        if (dragEl.dataset.list !== item.dataset.list) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        item.classList.add('is-drag-over');
      });
      item.addEventListener('dragleave', () => item.classList.remove('is-drag-over'));
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!dragEl || dragEl === item) return;
        if (dragEl.dataset.list !== item.dataset.list) return;
        const listPath = item.dataset.list;
        const from = Number(dragEl.dataset.index);
        const to   = Number(item.dataset.index);
        const arr = getPath(state.data, listPath) || [];
        const [moved] = arr.splice(from, 1);
        arr.splice(to, 0, moved);
        state.dirty = true;
        renderSection();
      });
    });

    // Dropzone(s) for file upload
    $$('#form [data-drop]').forEach(zone => {
      const input = zone.querySelector('[data-file-input]');
      zone.addEventListener('click', () => input.click());
      zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
      zone.addEventListener('drop', async (e) => {
        e.preventDefault(); zone.classList.remove('is-over');
        if (e.dataTransfer?.files?.length) await handleUpload(e.dataTransfer.files);
      });
      input.addEventListener('change', async () => {
        if (input.files?.length) await handleUpload(input.files);
        input.value = '';
      });
    });
  }

  // Return a function that constructs a new default item for a given list path
  function protoFor(path) {
    const p = path;
    if (p === 'hero.rotator')      return () => ({ lang:'en', text:'new tagline' });
    if (p === 'hero.meta_stats')   return () => ({ num:'00', label:'new stat\nsub-line' });
    if (p === 'hero.polaroids')    return () => ({ image:'', alt:'', caption:'', tape:'top' });
    if (p === 'about.paragraphs')  return () => 'A new paragraph.';
    if (p === 'about.chips')       return () => ({ code:'XX', label:'New language' });
    if (p === 'about.stats')       return () => ({ b:'Label', span:'value' });
    if (p === 'stages.events')     return () => ({ year:String(new Date().getFullYear()), title:'New event', desc:'', lang:'EN', register:'formal' });
    if (p === 'stages.keypeople')  return () => ({ name:'Name', role:'Role' });
    if (p === 'clients')           return () => 'New Client';
    if (p === 'gallery.items')     return () => ({ image:'', alt:'', title:'', subtitle:'', span:'normal' });
    if (p === 'reels.videos')      return () => 'assets/videos/new.mp4';
    if (p === 'voices.items')      return () => ({ quote:'New quote.', cite:'attribution' });
    if (p === 'book.actions')      return () => ({ label:'button', href:'#', type:'ghost' });
    if (p === 'book.facts')        return () => ({ b:'Label', text:'value' });
    if (p === 'nav.links')         return () => ({ num:'00', label:'Link', href:'#' });
    if (p === 'marquee')           return () => 'new phrase ·';
    return () => ({});
  }

  // ============================================================
  //   Upload
  // ============================================================
  async function handleUpload(files) {
    toast(`uploading ${files.length} file${files.length===1?'':'s'}…`);
    const res = await api.upload(files);
    if (!res.ok) {
      toast(`upload failed: ${res.error||'unknown'}`, 'err', 5000);
      return;
    }
    state.uploadedThisSession.push(...res.files);
    const list = res.files.map(f => `<div><code>${f}</code></div>`).join('');
    toast(`<strong>Uploaded:</strong>${list}`, 'ok', 4500);
  }

  // ============================================================
  //   Save + Publish
  // ============================================================
  async function publish() {
    const btn = $('#btnPublish');
    btn.disabled = true;
    btn.classList.add('is-loading');
    const note = $('#noteInput').value.trim();

    try {
      // Save first (writes content.json)
      const saveRes = await api.saveData(state.data);
      if (!saveRes.ok) { toast(`save failed: ${saveRes.error||'unknown'}`, 'err', 5000); return; }

      // Then publish (commits + pushes)
      const res = await api.publish(state.data, state.uploadedThisSession, note);
      if (!res.ok) {
        if (res.committed) {
          toast(`Committed locally <span class="sha">${res.sha}</span>, but push failed: ${res.error}`, 'warn', 6000);
        } else {
          toast(`Publish failed: ${res.error||'unknown'}`, 'err', 6000);
        }
      } else if (res.no_changes) {
        toast(`No changes to publish.`, '', 3000);
      } else {
        const push = res.pushed ? 'pushed' : 'committed';
        toast(`${push} <span class="sha">${res.sha}</span> · <strong>${res.summary}</strong>`, 'ok', 6500);
        state.uploadedThisSession = [];
        state.dirty = false;
        $('#noteInput').value = '';
        setTimeout(() => refreshPreview(), 400);
      }
      refreshStatus();
    } catch (e) {
      toast(`Publish error: ${e.message||e}`, 'err', 5000);
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  }

  // ============================================================
  //   Git status + preview
  // ============================================================
  async function refreshStatus() {
    try {
      const s = await api.status();
      $('#badgeBranch').textContent = 'branch: ' + (s.branch || '?');
      const dirty = s.dirty_count || 0;
      const dEl = $('#badgeDirty');
      dEl.textContent = dirty ? `changes: ${dirty}` : 'clean';
      dEl.classList.toggle('is-dirty', dirty > 0);
      dEl.classList.toggle('is-clean', dirty === 0);
      $('#badgeSha').textContent = 'HEAD: ' + (s.sha || '—');
    } catch(e) { /* silent */ }
  }
  function refreshPreview() {
    const frame = $('#previewFrame');
    if (!frame) return;
    frame.src = '/?admin=1&_=' + Date.now();
  }

  // ============================================================
  //   History drawer
  // ============================================================
  async function openHistory() {
    const res = await api.history();
    const list = $('#drawerList');
    if (res.commits) {
      list.innerHTML = res.commits.map(c => {
        const d = new Date(c.ts * 1000);
        const when = d.toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
        return `<li>
          <span class="sha">${escape(c.sha)}</span>
          <span class="subject">${escape(c.subject)}</span>
          <span class="ts">${escape(when)} · ${escape(c.author)}</span>
        </li>`;
      }).join('');
    } else {
      list.innerHTML = `<li class="empty">no history yet.</li>`;
    }
    $('#drawer').classList.add('is-open');
  }

  // ============================================================
  //   Init
  // ============================================================
  async function init() {
    const data = await api.getData();
    if (data.error) { toast(`Failed to load: ${data.error}`, 'err', 6000); return; }
    state.data = data;
    renderSection();
    refreshStatus();

    // Section nav
    $$('.section-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.section-btn').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        state.section = btn.dataset.section;
        renderSection();
        $('.panel').scrollTop = 0;
      });
    });

    // Global buttons
    $('#btnPublish').addEventListener('click', publish);
    $('#btnRefreshPreview').addEventListener('click', refreshPreview);
    $('#btnHistory').addEventListener('click', openHistory);
    $('#drawerClose').addEventListener('click', () => $('#drawer').classList.remove('is-open'));
    $('#btnOpenNew').addEventListener('click', () => window.open('/', '_blank'));

    // Cmd/Ctrl+S to publish
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        publish();
      }
    });

    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', (e) => {
      if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  init();
})();
