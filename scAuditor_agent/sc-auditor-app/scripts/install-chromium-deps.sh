#!/bin/bash
# install-chromium-deps.sh — Download Chromium system dependencies as non-root.
#
# The Databricks App container (Ubuntu 22.04) runs as uid=1000(app) with no
# sudo access. This script downloads required .deb packages and extracts
# their shared libraries to a local directory.
#
# Usage: Called from npm prestart. The start script must set:
#   LD_LIBRARY_PATH=/tmp/chromium-deps/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH

set -euo pipefail

DEPS_DIR="/tmp/chromium-deps"
DEB_DIR="/tmp/chromium-debs"
LIB_DIR="$DEPS_DIR/usr/lib/x86_64-linux-gnu"
CHROME="/tmp/pw-browsers/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell"

# Full package list for Chromium headless shell on Ubuntu 22.04 (jammy).
PACKAGES=(
  # Core Chromium deps (direct ldd output)
  libnspr4
  libnss3
  libnssutil3
  libatk1.0-0
  libatk-bridge2.0-0
  libxcomposite1
  libxdamage1
  libxfixes3
  libxrandr2
  libgbm1
  libxkbcommon0
  libasound2
  libatspi2.0-0
  # Transitive deps
  libxrender1
  libx11-6
  libxcb1
  libxext6
  libxi6
  libxtst6
  libdrm2
  libcairo2
  libpango-1.0-0
  libpangocairo-1.0-0
  libcups2
  libdbus-1-3
  libexpat1
  libfontconfig1
  libfreetype6
  libglib2.0-0
  libwayland-client0
  libwayland-server0
  libxcb-render0
  libxcb-shm0
  libxcb-randr0
  libpixman-1-0
  libpng16-16
  libharfbuzz0b
  libgraphite2-3
  libbrotli1
  libfribidi0
  libthai0
  libdatrie1
  libxau6
  libxdmcp6
)

# Check if already fully resolved (ldd shows no missing libs)
check_resolved() {
  [ -f "$CHROME" ] || return 1
  local missing
  missing=$(LD_LIBRARY_PATH="$LIB_DIR:${LD_LIBRARY_PATH:-}" ldd "$CHROME" 2>&1 | grep -c 'not found' || true)
  [ "$missing" -eq 0 ]
}

if [ -d "$LIB_DIR" ] && check_resolved 2>/dev/null; then
  echo "[chromium-deps] All libraries already resolved"
  exit 0
fi

mkdir -p "$DEPS_DIR" "$DEB_DIR"

# ── Download via apt-cache show + curl ─────────────────────────────────
download_packages() {
  local mirror="http://archive.ubuntu.com/ubuntu"
  cd "$DEB_DIR"
  local downloaded=0 skipped=0 failed=0

  for pkg in "${PACKAGES[@]}"; do
    if ls "${pkg}"_*.deb 1>/dev/null 2>&1; then
      skipped=$((skipped + 1))
      continue
    fi

    local filename
    filename=$(apt-cache show "$pkg" 2>/dev/null | grep "^Filename:" | head -1 | awk '{print $2}' || true)
    if [ -z "$filename" ]; then
      echo "  [WARN] apt-cache has no entry for $pkg"
      failed=$((failed + 1))
      continue
    fi

    if curl -fsSL -o "$(basename "$filename")" "$mirror/$filename" 2>/dev/null; then
      downloaded=$((downloaded + 1))
    else
      echo "  [WARN] curl failed for $pkg ($mirror/$filename)"
      failed=$((failed + 1))
    fi
  done

  echo "[chromium-deps] Downloaded: $downloaded, cached: $skipped, failed: $failed"
  local total
  total=$(ls -1 "$DEB_DIR"/*.deb 2>/dev/null | wc -l)
  echo "[chromium-deps] Total .deb files: $total"
  [ "$total" -gt 0 ]
}

# ── Extract .so files from .deb packages ──────────────────────────────
extract_debs() {
  echo "[chromium-deps] Extracting shared libraries..."
  cd "$DEB_DIR"
  for deb in *.deb; do
    [ -f "$deb" ] || continue
    dpkg-deb -x "$deb" "$DEPS_DIR" 2>/dev/null || true
  done
}

# ── Verify via ldd ───────────────────────────────────────────────────
verify() {
  if [ ! -f "$CHROME" ]; then
    echo "[chromium-deps] Chrome binary not found — skipping ldd verify"
    return 0
  fi

  echo "[chromium-deps] Checking remaining missing libraries..."
  local missing
  missing=$(LD_LIBRARY_PATH="$LIB_DIR:${LD_LIBRARY_PATH:-}" ldd "$CHROME" 2>&1 | grep 'not found' || true)
  if [ -z "$missing" ]; then
    echo "[chromium-deps] ALL shared libraries resolved!"
    return 0
  else
    local count
    count=$(echo "$missing" | wc -l)
    echo "[chromium-deps] $count libraries still missing:"
    echo "$missing"
    return 1
  fi
}

# ── Main ─────────────────────────────────────────────────────────────────
echo "[chromium-deps] Installing Chromium system deps (non-root, ${#PACKAGES[@]} packages)..."

if download_packages; then
  extract_debs
  verify || true
else
  echo "[chromium-deps] ERROR: Package download failed"
  exit 1
fi
