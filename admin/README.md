# Ananth · Admin

Local-only editor for the portfolio.
Runs at `http://127.0.0.1:5757/admin/`.
On **Confirm & Publish** it saves `assets/data/content.json`, resizes any
newly uploaded photos, then commits + pushes to GitHub with a mechanical
summary as the commit message.

## Start

```bash
./admin/run.sh
# or a custom port:
./admin/run.sh 5858
```

Then open **http://127.0.0.1:5757/admin/**.
The live preview iframe on the right shows your real site.

## What it can do

- **Edit any section** — hero, about, stages/events, gallery, reels, voices,
  booking, nav, marquee, meta/SEO. Every field is a form input.
- **Drag to reorder** anything in a list (events, photos, chips, quotes, …).
- **Upload photos** — drag files onto any dropzone. They're resized with
  `sips` (macOS built-in) to max 1600px on the longest side and saved into
  `assets/images/`. HEIC files are converted to JPG automatically.
- **Upload videos** — MP4 / MOV / WebM. No resizing.
- **Confirm & Publish** — save → commit → push. Toast shows the auto-generated
  commit message and the short SHA. `⌘S` / `Ctrl+S` also triggers it.
- **`git log` drawer** — click the button in the sidebar to see the last 20 commits.

## How commit messages are built

The server diffs the JSON before/after and generates a punctuated summary:

```
admin: added event 'Datathon 2025' · +2 photos · updated hero blurb
```

If you type a note in the top-bar input, it gets prefixed:

```
admin: fixing Deepavali date — updated stages events
```

## Safety

- Server binds to `127.0.0.1` only — never reachable from the network.
- Every save first snapshots the previous `content.json` into `.backups/`
  (kept: last 20).
- Every POST route requires the request to come from the admin origin
  (Referer / Origin check).
- Max upload size: 40 MB per request.
- If the push to GitHub fails (offline, auth), the commit is still saved
  locally and the toast tells you — the next successful publish sends both.

## Files

```
admin/
├── server.py       # Python http.server, stdlib only
├── index.html      # admin UI shell
├── admin.css       # dashboard styles
├── admin.js        # form logic, drag-drop, upload, publish
├── run.sh          # `python3 admin/server.py`
└── README.md       # this file
```
