#!/usr/bin/env python3
"""
Ananth · Admin Server
Local-only editor for content.json + photo uploads + git publish.

Bound to 127.0.0.1:5757 by default (never exposed to the network).
Uses only the Python standard library — no pip installs.
"""

from __future__ import annotations

import cgi
import io
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
from datetime import datetime
from http import HTTPStatus
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

# --- paths -------------------------------------------------------------------
REPO = Path(__file__).resolve().parent.parent
ADMIN_DIR = Path(__file__).resolve().parent
DATA_FILE = REPO / "assets" / "data" / "content.json"
BACKUP_DIR = REPO / ".backups"
IMAGES_DIR = REPO / "assets" / "images"
VIDEOS_DIR = REPO / "assets" / "videos"

# --- config ------------------------------------------------------------------
BIND_HOST = "127.0.0.1"
BIND_PORT = 5757
MAX_UPLOAD_MB = 40
IMAGE_MAX_PX = 1600     # sips resize target
KEEP_BACKUPS = 20

# ANSI helpers for the console log
def _c(code, s): return f"\033[{code}m{s}\033[0m"
INFO = lambda s: print(_c("36", "▸"), s, flush=True)
OK   = lambda s: print(_c("32", "✓"), s, flush=True)
WARN = lambda s: print(_c("33", "!"), s, flush=True)
ERR  = lambda s: print(_c("31", "✗"), s, flush=True)


# --- helpers ------------------------------------------------------------------

def _shell(cmd: list[str], cwd: Path = REPO, timeout: int = 60) -> tuple[int, str, str]:
    """Run a shell command; return (rc, stdout, stderr)."""
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        return r.returncode, r.stdout.strip(), r.stderr.strip()
    except subprocess.TimeoutExpired:
        return 124, "", "timed out"
    except FileNotFoundError as e:
        return 127, "", str(e)


def _read_json() -> dict:
    with DATA_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(obj: dict) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = DATA_FILE.with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    tmp.replace(DATA_FILE)


def _backup_current() -> Path | None:
    """Snapshot content.json into .backups/ before overwriting."""
    if not DATA_FILE.exists():
        return None
    BACKUP_DIR.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    dst = BACKUP_DIR / f"content-{stamp}.json"
    shutil.copy2(DATA_FILE, dst)
    # prune to KEEP_BACKUPS most recent
    snaps = sorted(BACKUP_DIR.glob("content-*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    for old in snaps[KEEP_BACKUPS:]:
        try: old.unlink()
        except OSError: pass
    return dst


def _diff_summary(before: dict, after: dict, new_photos: list[str]) -> str:
    """Compute a human-friendly, punctuated summary of what changed."""
    parts: list[str] = []

    def has_changed(path):
        b = _dig(before, path); a = _dig(after, path)
        return json.dumps(b, sort_keys=True) != json.dumps(a, sort_keys=True)

    # ------ scalar text edits ------
    scalar_map = {
        "hero.eyebrow": "hero eyebrow",
        "hero.name": "hero name",
        "hero.lead": "hero lead",
        "hero.blurb": "hero blurb",
        "hero.primary_cta.label": "primary CTA label",
        "hero.secondary_cta.label": "secondary CTA label",
        "about.title_line1": "about title",
        "about.title_line2_ink": "about title ink",
        "about.quote.text": "about quote",
        "about.quote.source": "quote source",
        "about.portrait.tag": "portrait tag",
        "stages.title_line1": "stages title",
        "stages.title_line2_ink": "stages title ink",
        "stages.lede": "stages lede",
        "gallery.title_line1": "gallery title",
        "gallery.title_line2_ink": "gallery title ink",
        "gallery.lede": "gallery lede",
        "voices.title_line1": "voices title",
        "voices.title_line2_ink": "voices title ink",
        "book.title_line1": "book title",
        "book.title_line2_ink": "book title ink",
        "book.lede": "book lede",
        "meta.site_title": "site title",
        "meta.description": "meta description",
        "meta.footer_signature": "footer signature",
        "meta.footer_tag": "footer tag",
    }
    text_changes = [label for path, label in scalar_map.items() if has_changed(path)]
    if text_changes:
        if len(text_changes) <= 2:
            parts.append("updated " + " & ".join(text_changes))
        else:
            parts.append(f"updated {len(text_changes)} text fields")

    # ------ list additions / removals ------
    def list_delta(path, name_key, label_singular):
        b = _dig(before, path) or []
        a = _dig(after, path) or []
        b_ids = {_item_id(x, name_key) for x in b}
        a_ids = {_item_id(x, name_key) for x in a}
        added   = [x for x in a if _item_id(x, name_key) not in b_ids]
        removed = [x for x in b if _item_id(x, name_key) not in a_ids]
        # reorder detection
        common_before = [_item_id(x, name_key) for x in b if _item_id(x, name_key) in a_ids]
        common_after  = [_item_id(x, name_key) for x in a if _item_id(x, name_key) in b_ids]
        reordered = common_before and common_after and common_before != common_after

        if added:
            if len(added) == 1 and name_key in added[0]:
                parts.append(f"added {label_singular} '{added[0][name_key]}'")
            else:
                parts.append(f"+{len(added)} {label_singular}s")
        if removed:
            if len(removed) == 1 and name_key in removed[0]:
                parts.append(f"removed {label_singular} '{removed[0][name_key]}'")
            else:
                parts.append(f"-{len(removed)} {label_singular}s")
        # mention edits of retained items (aside from add/remove)
        edits = 0
        b_by_id = {_item_id(x, name_key): x for x in b}
        a_by_id = {_item_id(x, name_key): x for x in a}
        for k in a_ids & b_ids:
            if json.dumps(a_by_id[k], sort_keys=True) != json.dumps(b_by_id[k], sort_keys=True):
                edits += 1
        if edits and not added and not removed:
            parts.append(f"edited {edits} {label_singular}{'s' if edits > 1 else ''}")
        if reordered and not added and not removed:
            parts.append(f"reordered {label_singular}s")

    list_delta("stages.events", "title",  "event")
    list_delta("gallery.items", "image",  "photo")
    list_delta("reels.videos",  None,     "reel")
    list_delta("voices.items",  "quote",  "voice")
    list_delta("stages.keypeople", "name","key person")
    list_delta("about.chips",   "label",  "language chip")
    list_delta("about.stats",   "b",      "about stat")
    list_delta("book.actions",  "label",  "book action")
    list_delta("book.facts",    "b",      "book fact")
    list_delta("marquee",       None,     "marquee line")
    list_delta("clients",       None,     "client")
    list_delta("hero.polaroids","image",  "polaroid")
    list_delta("hero.meta_stats","num",   "hero stat")
    list_delta("hero.rotator",  "text",   "rotator line")
    list_delta("nav.links",     "label",  "nav link")

    # ------ uploaded but unused-yet photos ------
    if new_photos:
        parts.append(f"uploaded {len(new_photos)} new file{'s' if len(new_photos)!=1 else ''}")

    if not parts:
        return "tidy up · no visible changes"
    msg = " · ".join(parts)
    if len(msg) > 120:
        msg = msg[:117] + "…"
    return msg


def _dig(obj, dotted):
    cur = obj
    for k in dotted.split("."):
        if cur is None: return None
        cur = cur.get(k) if isinstance(cur, dict) else None
    return cur


def _item_id(x, name_key):
    if isinstance(x, dict) and name_key and name_key in x:
        return f"{name_key}:{x[name_key]}"
    return json.dumps(x, sort_keys=True)


def _sips_resize(path: Path) -> None:
    """Downsize an image in place to max IMAGE_MAX_PX on longest side."""
    if not path.exists():
        return
    if path.suffix.lower() in {".heic", ".heif"}:
        jpg = path.with_suffix(".jpg")
        _shell(["sips", "-s", "format", "jpeg", "-Z", str(IMAGE_MAX_PX), str(path), "--out", str(jpg)])
        try: path.unlink()
        except OSError: pass
    else:
        _shell(["sips", "-Z", str(IMAGE_MAX_PX), str(path), "--out", str(path)])


def _git_publish(commit_msg: str) -> dict:
    """git add . && git commit && git push. Returns dict with fields."""
    rc, out, err = _shell(["git", "status", "--porcelain"])
    if rc != 0:
        return {"ok": False, "step": "status", "error": err or "git status failed"}
    if not out.strip():
        return {"ok": True, "no_changes": True, "message": "nothing to commit"}

    rc, _, err = _shell(["git", "add", "-A"])
    if rc != 0:
        return {"ok": False, "step": "add", "error": err}

    rc, out, err = _shell(["git", "commit", "-m", commit_msg])
    if rc != 0:
        return {"ok": False, "step": "commit", "error": err or out}
    # extract short hash
    _, sha, _ = _shell(["git", "rev-parse", "--short", "HEAD"])

    rc, out, err = _shell(["git", "push", "origin", "HEAD"], timeout=120)
    if rc != 0:
        return {"ok": False, "step": "push", "error": err or out, "sha": sha, "committed": True, "message": commit_msg}
    return {"ok": True, "sha": sha, "message": commit_msg, "pushed": True}


# --- HTTP handler -------------------------------------------------------------

class AdminHandler(SimpleHTTPRequestHandler):
    server_version = "AnanthAdmin/1.0"

    # Serve admin UI at /admin/*, otherwise serve repo files (index.html + assets)
    def translate_path(self, path):
        # split query
        path = path.split("?", 1)[0].split("#", 1)[0]
        if path.startswith("/admin/") or path == "/admin":
            rel = path[len("/admin"):].lstrip("/") or "index.html"
            return str(ADMIN_DIR / rel)
        if path == "/" or path == "":
            return str(REPO / "index.html")
        return str(REPO / path.lstrip("/"))

    def log_message(self, fmt, *args):
        # concise access log
        print(_c("90", f"[{self.log_date_time_string()}] {fmt % args}"), flush=True)

    def end_headers(self):
        # no cache for JSON so the preview iframe sees fresh saves
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    # ---- routing ----
    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/api/data":
            return self._api_get_data()
        if u.path == "/api/status":
            return self._api_status()
        if u.path == "/api/history":
            return self._api_history()
        return super().do_GET()

    def do_POST(self):
        # Same-origin guard: only allow requests from our own admin UI
        origin = self.headers.get("Origin", "")
        ref = self.headers.get("Referer", "")
        allowed = f"http://{BIND_HOST}:{BIND_PORT}"
        if origin and not origin.startswith(allowed) and not ref.startswith(allowed):
            return self._json({"ok": False, "error": "cross-origin blocked"}, HTTPStatus.FORBIDDEN)

        u = urllib.parse.urlparse(self.path)
        if u.path == "/api/data":
            return self._api_save_data()
        if u.path == "/api/upload":
            return self._api_upload()
        if u.path == "/api/publish":
            return self._api_publish()
        return self._json({"ok": False, "error": "not found"}, HTTPStatus.NOT_FOUND)

    # ---- api impls ----
    def _api_get_data(self):
        try:
            return self._json(_read_json())
        except Exception as e:
            return self._json({"error": str(e)}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def _api_status(self):
        _, branch, _ = _shell(["git", "rev-parse", "--abbrev-ref", "HEAD"])
        # Use --no-strip and parse porcelain rows preserving leading columns
        r = subprocess.run(["git", "status", "--porcelain"], cwd=REPO, capture_output=True, text=True)
        dirty_raw = r.stdout
        dirty_lines = [ln for ln in dirty_raw.splitlines() if ln]
        _, ahead, _  = _shell(["git", "rev-list", "--count", "@{u}..HEAD"]) if branch else (0, "0", "")
        _, sha, _    = _shell(["git", "rev-parse", "--short", "HEAD"])
        _, url, _    = _shell(["git", "remote", "get-url", "origin"])
        dirty_files  = [ln[3:] if len(ln) > 3 else ln for ln in dirty_lines]
        return self._json({
            "branch": branch or None,
            "sha": sha or None,
            "remote": url or None,
            "ahead": int(ahead) if ahead.isdigit() else 0,
            "dirty_count": len(dirty_lines),
            "dirty_files": dirty_files[:30],
        })

    def _api_history(self):
        rc, out, err = _shell(["git", "log", "-n", "20", "--pretty=format:%h\t%an\t%at\t%s"])
        if rc != 0:
            return self._json({"error": err or "git log failed"}, HTTPStatus.INTERNAL_SERVER_ERROR)
        rows = []
        for ln in out.splitlines():
            parts = ln.split("\t", 3)
            if len(parts) < 4: continue
            sha, author, ts, subject = parts
            rows.append({"sha": sha, "author": author, "ts": int(ts), "subject": subject})
        return self._json({"commits": rows})

    def _api_save_data(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length)
            new_data = json.loads(body.decode("utf-8"))
        except Exception as e:
            return self._json({"ok": False, "error": f"bad json: {e}"}, HTTPStatus.BAD_REQUEST)
        try:
            _backup_current()
            _write_json(new_data)
            return self._json({"ok": True, "saved_at": time.time()})
        except Exception as e:
            return self._json({"ok": False, "error": str(e)}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def _api_upload(self):
        """Accept multipart/form-data with one or more files; resize photos with sips."""
        ctype = self.headers.get("Content-Type", "")
        if not ctype.startswith("multipart/form-data"):
            return self._json({"ok": False, "error": "expected multipart"}, HTTPStatus.BAD_REQUEST)

        length = int(self.headers.get("Content-Length", "0"))
        if length > MAX_UPLOAD_MB * 1024 * 1024:
            return self._json({"ok": False, "error": f"file too large (>{MAX_UPLOAD_MB}MB)"}, HTTPStatus.REQUEST_ENTITY_TOO_LARGE)

        env = {"REQUEST_METHOD": "POST", "CONTENT_TYPE": ctype, "CONTENT_LENGTH": str(length)}
        try:
            form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ=env, keep_blank_values=True)
        except Exception as e:
            return self._json({"ok": False, "error": f"upload parse failed: {e}"}, HTTPStatus.BAD_REQUEST)

        saved = []
        files = form["file"] if "file" in form else []
        if not isinstance(files, list):
            files = [files]

        IMAGES_DIR.mkdir(parents=True, exist_ok=True)
        VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

        for item in files:
            if not getattr(item, "filename", None):
                continue
            safe_name = _safe_filename(item.filename)
            ext = safe_name.rsplit(".", 1)[-1].lower() if "." in safe_name else ""
            target_dir = VIDEOS_DIR if ext in {"mp4", "mov", "webm"} else IMAGES_DIR
            dest = target_dir / safe_name
            # avoid overwriting: append -1, -2, ...
            i = 1
            base, dot, extt = safe_name.rpartition(".")
            while dest.exists():
                candidate = f"{base}-{i}.{extt}" if dot else f"{safe_name}-{i}"
                dest = target_dir / candidate
                i += 1
            with dest.open("wb") as f:
                shutil.copyfileobj(item.file, f)
            # resize photos in-place
            if target_dir is IMAGES_DIR:
                _sips_resize(dest)
                # if HEIC → renamed to .jpg
                if not dest.exists() and dest.with_suffix(".jpg").exists():
                    dest = dest.with_suffix(".jpg")
            rel = dest.relative_to(REPO).as_posix()
            saved.append(rel)
            INFO(f"uploaded → {rel}")

        return self._json({"ok": True, "files": saved})

    def _api_publish(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length) if length else b"{}"
            payload = json.loads(body.decode("utf-8"))
        except Exception:
            payload = {}

        new_data = payload.get("data")
        new_photos = payload.get("uploaded", [])
        note = (payload.get("note") or "").strip()

        try:
            before = _read_json()
        except Exception:
            before = {}

        # If the UI sent a fresh data blob, save it first
        if isinstance(new_data, dict):
            _backup_current()
            _write_json(new_data)
            after = new_data
        else:
            after = before

        summary = _diff_summary(before, after, new_photos)
        commit_msg = f"admin: {summary}"
        if note:
            commit_msg = f"admin: {note} — {summary}" if summary != "tidy up · no visible changes" else f"admin: {note}"

        result = _git_publish(commit_msg)
        result["summary"] = summary
        return self._json(result)

    # ---- utils ----
    def _json(self, obj, status=HTTPStatus.OK):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def _safe_filename(name: str) -> str:
    name = os.path.basename(name)
    name = re.sub(r"[^A-Za-z0-9._-]+", "-", name)
    name = name.strip("-.") or f"upload-{int(time.time())}"
    return name


# --- main --------------------------------------------------------------------

def main():
    global BIND_PORT
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        BIND_PORT = int(sys.argv[1])

    if not DATA_FILE.exists():
        ERR(f"content.json not found at {DATA_FILE}")
        sys.exit(1)

    _, git_ok, _ = _shell(["git", "rev-parse", "--is-inside-work-tree"])
    if git_ok != "true":
        WARN("not inside a git repo — publish will fail until you `git init` / `git remote add origin ...`")

    httpd = HTTPServer((BIND_HOST, BIND_PORT), AdminHandler)
    url = f"http://{BIND_HOST}:{BIND_PORT}/admin/"
    print("")
    print("  ", _c("1;35", "Ananth Admin"), _c("90", "· local editor"))
    print("  ", _c("36", "→"), _c("1", url))
    print("  ", _c("90", "preview:"), _c("4", f"http://{BIND_HOST}:{BIND_PORT}/"))
    print("  ", _c("90", "ctrl-c to stop"))
    print("")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n", _c("90", "bye."))
        httpd.server_close()


if __name__ == "__main__":
    main()
