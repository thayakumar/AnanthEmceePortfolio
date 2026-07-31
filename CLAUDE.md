# CLAUDE.md — Ananth Emcee Portfolio

Read this before touching the project. It captures the whole design + admin system so a new session can pick up where the last one left off.

## What this is

A personal portfolio site for **Ananth**, a Kuala Lumpur–based multilingual emcee (Bahasa Malaysia · English · Tamil) early in his career. The site is single-page, chalkboard-themed, and served as static files. It comes with a **local admin** that lets him edit content in a form UI and auto-commits + pushes each publish to GitHub with a mechanical summary as the commit message.

- **GitHub repo:** `thayakumar/AnanthEmceePortfolio` (default branch `main`)
- **Local repo path:** `/Users/tigerlab/Downloads/GitHubProjects/EmceePortfolio/repo`
- **Public site host:** none yet — currently just committed to the repo. Could be GitHub Pages, Vercel static, or Netlify with zero config.
- **Owner's git identity:** `ananthtigerlab <thayananth.kumaresan@tigerlab.com>`

## Design language (portfolio)

- **Vibe:** chalkboard-stage. Dark slate green base, chalk-white type, taped polaroid photos, vibrant red/yellow/pink accents. Kinetic + hand-drawn + a little bit of stage fright. Reference: the "MAITRA RAMANUJ" chalkboard mockup the user showed.
- **Palette:** `--bg-0 #0e1010`, `--bg-1 #14201c` (slate green), `--chalk #f4ede2`, `--red #ff3a20`, `--yellow #ffd23f`, `--pink #ff5e9a`, `--mint #7be0c4`.
- **Type stack:**
  - Display: **Anton** (big bold blocky title)
  - Marker: **Permanent Marker** (chalk-drawn feel)
  - Hand: **Caveat** (handwritten captions, hints)
  - Serif italic: **Instrument Serif** (tagline italics, quotes)
  - Body: **Space Grotesk**
  - Tamil: **Noto Sans Tamil** (used for one rotator line — see hero)
- **Voice:** humble, honest ("still early days"). Never oversells experience. Highlights the language range, the range of crowds (kids → officials), and the small comedian instinct.
- **Sections in reading order:** loader → nav → hero → marquee band → about → stages/events (filterable timeline) → clients marquee → gallery (photo wall with lightbox) → reels row → voices (quotes) → book (CTA) → footer.

## File layout

```
repo/
├── CLAUDE.md                 (this file)
├── README.md                 (short, existed before)
├── .gitignore                (.DS_Store, node_modules, .env, IDE dirs)
├── index.html                LEAN SHELL. Contains <head>, loader, nav+
│                             sections as empty <section data-render="X"></section>.
│                             render.js hydrates each one from content.json.
│
├── assets/
│   ├── data/
│   │   └── content.json      SOURCE OF TRUTH for every editable piece of copy,
│   │                          list, photo path, testimonial. See schema below.
│   ├── css/
│   │   └── styles.css        All portfolio styles. Uses .js-anim class gate on
│   │                          <html> (added by main.js) so items are visible
│   │                          without JS. Chalkboard surface, per-section styles,
│   │                          reveal-on-scroll rules, reduced-motion overrides.
│   ├── js/
│   │   ├── render.js         Fetches content.json, hydrates every
│   │   │                     [data-render="X"] section, dispatches
│   │   │                     'content:rendered' event.
│   │   └── main.js           Waits for content:rendered (or DOM present),
│   │                         then wires: chalk-dust canvas, custom cursor,
│   │                         language rotator, IO scroll reveals + RAF fallback,
│   │                         nav scroll state + mobile toggle, timeline filters,
│   │                         gallery lightbox, reels hover-play, parallax polaroids.
│   ├── images/               33 curated photos. HEIC → JPG converted, downsized
│   │                         to max 1600px via `sips`. Total ~12 MB.
│   ├── videos/               6 short MP4 reels under 12 MB each.
│   └── fonts/                (empty, using Google Fonts via CDN)
│
├── admin/                    LOCAL EDITOR (see next section)
│   ├── server.py             Python stdlib http.server, no pip deps
│   ├── index.html            Admin UI shell (sidebar + form + preview iframe)
│   ├── admin.css             Light dashboard theme — deliberately unlike the
│   │                         chalkboard site so it's clearly a tool.
│   ├── admin.js              Section forms, drag-drop reorder, upload, publish
│   ├── run.sh                `./admin/run.sh [port]` → starts server
│   └── README.md             Usage docs
│
└── .backups/                 Auto snapshots of content.json before every save.
                              Last 20 kept. Not committed (add to .gitignore if
                              you like — currently not ignored).
```

## content.json — schema

Top-level keys (all required unless noted):

- **`meta`** — `site_title`, `description`, `footer_signature`, `footer_tag`
- **`nav`** — `brand_short`, `brand_word`, `links` (array of `{num, label, href}`), `cta` `{label, href}`
- **`hero`** — `eyebrow`, `name` (rendered letter-by-letter), `lead`, `rotator` (array of `{lang: en|bm|ta, text}`), `blurb` (use `*em*` for hand-highlight), `primary_cta` + `secondary_cta` (`{label, href}`), `meta_stats` (array of `{num, label}` — `\n` in label = `<br/>`), `polaroids` (array of `{image, alt, caption, tape: top|left|right}`)
- **`marquee`** — array of strings (repeated 3× at render for seamless scroll)
- **`about`** — `num`, `num_label`, `title_line1`, `title_line2_ink`, `paragraphs` (array of strings, `*em*` supported), `quote` `{text, source}`, `chips` (array of `{code, label}`), `portrait` `{image, alt, tag}`, `stats` (array of `{b, span}`)
- **`stages`** — `num`, `num_label`, `title_line1`, `title_line2_ink`, `lede` (HTML allowed), `events` (array of `{year, title, desc, lang: EN|BM|TA, register: formal|informal}` — grouped by year in render), `keypeople_title`, `keypeople` (array of `{name, role}`)
- **`clients`** — array of strings (client / org names)
- **`gallery`** — `num`, `num_label`, `title_line1`, `title_line2_ink`, `lede`, `items` (array of `{image, alt, title, subtitle, span: normal|tall|wide}`)
- **`reels`** — `title`, `hint`, `videos` (array of paths)
- **`voices`** — `num`, `num_label`, `title_line1`, `title_line2_ink`, `items` (array of `{quote, cite}`)
- **`book`** — `title_line1`, `title_line2_ink`, `lede`, `actions` (array of `{label, href, type: primary|ghost}`), `facts` (array of `{b, text}`)

**When adding new fields:** update BOTH `render.js` (to render them) AND `admin.js` (to expose them in the form). Otherwise you'll add data that never shows and never gets edited.

## The admin — how it works

**Runs locally, at `http://127.0.0.1:5757/admin/`.** Bound to `127.0.0.1` only, never exposed on the network.

**Start:**
```bash
cd repo
./admin/run.sh          # port 5757 by default
./admin/run.sh 5858     # custom port
```

**API surface (`admin/server.py`):**

| Method | Path            | What it does |
|--------|-----------------|--------------|
| GET    | `/`             | Serves the public `index.html` (so the preview iframe can show it) |
| GET    | `/assets/...`   | Serves static assets |
| GET    | `/admin/`       | Admin UI |
| GET    | `/api/data`     | Returns current `content.json` |
| POST   | `/api/data`     | Saves body as `content.json` (backs up first) |
| POST   | `/api/upload`   | multipart file upload. Images → `sips` resized to 1600px, saved to `assets/images/`. Videos → saved to `assets/videos/`. Returns `{ok, files:[relpath,…]}` |
| POST   | `/api/publish`  | Body `{data?, uploaded?, note?}`. Saves data (if given), computes mechanical diff summary, `git add -A` + `git commit -m "admin: <summary>"` + `git push origin HEAD`. Returns SHA + summary. |
| GET    | `/api/status`   | Returns `{branch, sha, remote, ahead, dirty_count, dirty_files}` for the top-bar badges |
| GET    | `/api/history`  | Last 20 commits (`{sha, author, ts, subject}`) for the drawer |

**Safety guardrails:**
- Every POST checks `Origin`/`Referer` matches `http://127.0.0.1:<port>`.
- Every save snapshots the previous `content.json` into `.backups/content-<timestamp>.json` (keeps 20).
- Max upload: 40 MB per request.
- If `git push` fails (offline/auth), the commit is still saved locally; next successful publish sends both.

**Commit message shape:**
`admin: added event 'Datathon 2025' · +2 photos · updated hero blurb`

The message is built by `_diff_summary()` — it walks both JSONs, detects scalar changes, list adds/removes/reorders/edits, and produces a punctuated string. If the user typed a note in the top-bar field, it's prefixed as `admin: <note> — <summary>`.

**Uploaded-but-unused files** are counted as `uploaded N new files` in the summary. The admin also tracks new uploads for the session and re-sends them to `/api/publish` so the message reflects the actual work done.

## The site itself — how render + main work together

1. Browser loads `index.html` → parses shell, sees empty `<section data-render="hero"></section>` etc.
2. `render.js` runs, does `fetch('assets/data/content.json')`, waits.
3. `render.js` renders each section's inner HTML from a per-section template function inside itself (all templates live in one `renderers` object). It applies `data-hydrate="path.to.field"` substitutions too (for `<title>` and meta description).
4. `render.js` fires a `content:rendered` custom event on `document`.
5. `main.js`'s IIFE either runs immediately (if it detects populated DOM) or listens for `content:rendered` and initializes then.
6. `main.js` attaches all the interactions.

**If `content.json` fails to load** (fetch error), the site stays blank except for the loader shell — there's no HTML fallback because the sections are empty. Not ideal for SEO but acceptable for a personal site. Future improvement: pre-render HTML at publish time (server-side in `admin/server.py`) so the JSON becomes a pure hydration cache, not a hard requirement.

## Design gotchas I hit and how I solved them

- **CSS animations don't advance under headless Chrome's `--virtual-time-budget`.** The letter-by-letter entrance kept never rendering in screenshots. Fixed by moving the intro animation behind a `.js-anim` class gate on `<html>` — items are visible by default; JS opts them into the animation. That way headless screenshots (and no-JS users) always see content.
- **`[data-reveal]` items were invisible in headless.** Same problem — `opacity: 0 → 1` transition doesn't complete without wall-clock time. Solution: the `js-anim` gate applies the hidden initial state; JS adds `.is-in` via IntersectionObserver + a hard RAF fallback that unconditionally reveals any items still hidden after two frames.
- **`git status --porcelain` in Python.** `subprocess` output starts with a space for many rows (`" M path/to/file"`); doing `.strip()` on the whole blob ate the first row's leading space and made my `line[3:]` slice one char too eager. Server now uses raw output for the porcelain parse specifically.

## User preferences captured

- **Communication style:** casual, terse, gets to the point. Uses lowercase and typos ("liddat", "ntoe", "cmoot"). Prefers doers over askers ("i dont care proeceed").
- **Permission mode:** wants no permission prompts. Told him about `Shift+Tab` to cycle to **Bypass Permissions** and `.claude/settings.local.json` with `{"permissions":{"defaultMode":"bypassPermissions"}}` for durable.
- **Push behaviour:** every admin **Confirm & Publish** commits AND pushes to `origin/main` — no draft mode. He accepted this.
- **Reorder UI:** drag-and-drop, not up/down arrows only (though arrows are also present as fallback).
- **Commit summaries:** mechanical, from the JSON diff. No LLM in the loop for that.

## Known small things not done

- The site is not yet deployed to a public host. `git push` sends to the repo but nothing serves it. GitHub Pages on `main` + `/` would work with zero config; just needs enabling in repo settings.
- The `.backups/` directory is not in `.gitignore` — it currently gets committed. Might want to ignore it to keep the repo lean.
- No test file. The diff summary was smoke-tested manually. Fine for a hobby portfolio.
- Videos are not resized on upload (Python has no ffmpeg by default). Users are trusted to upload sensibly small clips.
- The letter-hover effect on the hero title has an ugly bug where `nth-child(even)` uses a different transform than `nth-child(odd)`. It looks fine but a designer might want to tighten it.
- The `_G8A3024.jpeg` used as the About portrait is the same person angle-shifted from the hero polaroid photo — good, no redundancy issue.

## How to iterate next time

- **Change a visual style:** edit `assets/css/styles.css`. Tokens are all at the top under `:root`.
- **Change what a section renders:** edit `assets/js/render.js` (the `renderers` object).
- **Change what fields the admin exposes:** edit `assets/js/admin/admin.js` (the `sections` object) AND add a default in `protoFor(path)`.
- **Add a whole new section:** update `content.json` schema → add `renderers.newSection` in `render.js` → add a `<section data-render="newSection">` in `index.html` → add a sidebar button + `sections.newSection` form in `admin.js`.

## Commands cheat-sheet

```bash
# preview site without admin (any static server)
cd repo && python3 -m http.server 8000

# admin (recommended way to work — includes the preview + git integration)
cd repo && ./admin/run.sh

# publish manually if the admin is unavailable
git add -A && git commit -m "…" && git push origin main
```
