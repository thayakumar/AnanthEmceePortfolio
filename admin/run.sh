#!/usr/bin/env bash
# Ananth admin — local editor. Runs on http://127.0.0.1:5757
set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR/.."
exec python3 "$DIR/server.py" "${1:-5757}"
