# Playwright System Dependencies — Non-Root Install

**Date:** 2026-04-25
**Duration:** ~30 minutes
**Deployments:** 3 iterations (01f14082..., 01f14083..., 01f14084...)

## Problem

After the earlier session fixed Playwright browser binary installation (`playwright install chromium` in `prestart`), Chromium still failed to launch with:

```
error while loading shared libraries: libnspr4.so: cannot open shared object file
```

`ldd` on the chrome-headless-shell binary revealed 13 missing shared libraries. Playwright's `install --with-deps` flag tried `sudo apt-get` which failed because the Databricks App container runs as `uid=1000(app)` with no root/sudo access at build or runtime.

## Root Cause

Playwright's Chromium headless shell depends on ~44 system shared libraries (NSS, ATK, GBM, X11/XCB, Pango, Cairo, Wayland, ALSA, etc.) that are not pre-installed in the Databricks App base image (Ubuntu 22.04). The missing libs include both **direct dependencies** (from `ldd` on chrome binary) and **transitive dependencies** (deps of those deps).

The container provides no mechanism to install system packages:
* `apt-get install` requires root
* `sudo` returns "Authentication failure"
* Build phase also runs as `uid=1000(app)` (non-root)

## Solution: `scripts/install-chromium-deps.sh`

A shell script that downloads `.deb` packages from the Ubuntu archive without root access:

1. **Resolve package paths** via `apt-cache show <pkg>` (reads pre-populated apt cache; no root needed)
2. **Download `.deb` files** via `curl` from `http://archive.ubuntu.com/ubuntu/<path>`
3. **Extract** with `dpkg-deb -x <deb> /tmp/chromium-deps/` (user-space extraction, no install)
4. **Verify** via `ldd` on the chrome binary with the custom `LD_LIBRARY_PATH`

### Key design decisions

* **`apt-cache show`** works as non-root because the apt package index is pre-populated in the base image. `apt-get download` (Strategy 1) failed because it requires lock files, but `apt-cache show` just reads the index.
* **Caching** — downloaded `.deb` files persist in `/tmp/chromium-debs/` across app restarts (same container), so subsequent starts skip the download phase.
* **`ldd` verification** — the script runs `ldd` on the actual chrome binary with the custom lib path and reports the exact count of remaining missing libraries, eliminating guesswork.

### Iteration history

| Deploy | Packages | Missing after | Blocker |
| --- | --- | --- | --- |
| #1 | 13 (direct deps only) | `libXrender.so.1` | Transitive dependencies not included |
| #2 | 42 (+ transitive deps) | `libwayland-server.so.0`, `libxcb-randr.so.0` | 2 more transitive deps |
| #3 | 44 (complete set) | **0** | **Chromium launches successfully** |

### Package list (44 packages)

**Direct Chromium deps (13):**
libnspr4, libnss3, libnssutil3, libatk1.0-0, libatk-bridge2.0-0, libxcomposite1, libxdamage1, libxfixes3, libxrandr2, libgbm1, libxkbcommon0, libasound2, libatspi2.0-0

**Transitive deps (31):**
libxrender1, libx11-6, libxcb1, libxext6, libxi6, libxtst6, libdrm2, libcairo2, libpango-1.0-0, libpangocairo-1.0-0, libcups2, libdbus-1-3, libexpat1, libfontconfig1, libfreetype6, libglib2.0-0, libwayland-client0, libwayland-server0, libxcb-render0, libxcb-shm0, libxcb-randr0, libpixman-1-0, libpng16-16, libharfbuzz0b, libgraphite2-3, libbrotli1, libfribidi0, libthai0, libdatrie1, libxau6, libxdmcp6

**Note:** `libnssutil3` consistently fails to download (1 of 44) because its `.so` is bundled inside the `libnss3` deb. All 44 required `.so` files are present after extraction.

## Wiring

### `package.json` scripts

```json
"prestart": "playwright install chromium 2>&1 | tail -3 && bash scripts/install-chromium-deps.sh || echo '[playwright] Browser setup incomplete'",
"start": "LD_LIBRARY_PATH=/tmp/chromium-deps/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH:-} NODE_ENV=production node --import ./dist/otel.js --env-file-if-exists=./.env ./dist/server.js"
```

### Startup sequence

1. `prestart` → `playwright install chromium` (112 MiB, ~9s, cached after first run)
2. `prestart` → `bash scripts/install-chromium-deps.sh` (43 debs, ~40s first run, cached after)
3. `start` → `LD_LIBRARY_PATH=... node dist/server.js`

## Additional Fix: OTel Server Spans Middleware

During this session, the app returned Internal Server Error (500) after the system deps attempts. Root cause: `otel-server-spans.ts` used `prependMiddleware()` which inserts middleware BEFORE Express's init middleware. The `req` object at that point is a raw `http.IncomingMessage` without Express methods.

**Broken code:**
```typescript
req.get('user-agent')     // TypeError: req.get is not a function
req.hostname              // undefined
req.protocol              // undefined
```

**Fixed code:**
```typescript
req.headers['user-agent']
req.headers.host?.split(':')[0] || 'unknown'
(req.socket as any)?.encrypted ? 'https' : 'http'
```

## Verification

OTel log output from final deployment:

```
[chromium-deps] Installing Chromium system deps (non-root, 44 packages)...
[chromium-deps] Downloaded: 2, cached: 41, failed: 1
[chromium-deps] Total .deb files: 43
[chromium-deps] Extracting shared libraries...
[chromium-deps] ALL shared libraries resolved!
[browser-test] Chromium launch OK (page title: "")
[appkit:server] Server running on http://0.0.0.0:8000
```

## Files Modified

| File | Change |
| --- | --- |
| `sc-auditor-app/scripts/install-chromium-deps.sh` | **New** — Non-root system deps installer (44 packages) |
| `sc-auditor-app/package.json` | `prestart` calls install script; `start` sets `LD_LIBRARY_PATH` |
| `sc-auditor-app/server/server.ts` | Added/removed temporary browser self-test |
| `sc-auditor-app/server/middleware/otel-server-spans.ts` | Fixed to use raw `http.IncomingMessage` properties |

## Key Insight: Non-Root Package Installation on Databricks Apps

The Databricks App container (Ubuntu 22.04) runs entirely as `uid=1000(app)`. No root access at build or runtime. But the apt **package index** (`/var/lib/apt/lists/`) is pre-populated from the image build, so `apt-cache show` works to resolve `.deb` file paths on the Ubuntu mirror. Combined with `curl` + `dpkg-deb -x` (user-space extraction), this provides a viable non-root package installation path for any missing system libraries.

| Tool | Requires root? | Works in App container? |
| --- | --- | --- |
| `apt-get install` | Yes | No |
| `apt-get download` | Partial (lock files) | No |
| `apt-cache show` | No | Yes |
| `curl` + `dpkg-deb -x` | No | Yes |
| `LD_LIBRARY_PATH` | No | Yes |
