# Playwright Runtime Install Fix

**Date:** 2026-04-25  
**Duration:** ~20 minutes  
**Deployment:** 01f14076763b11d18458557564088ee2 (dev)

## Problem

Playwright Chromium browser binary (~112 MiB) could not be installed during the Databricks App build phase. Previous attempts to run `npx playwright install chromium` in `postinstall` and `prebuild` npm hooks caused deployment failures ("Error installing packages" / "Error building app").

## Root Cause

1. **Build vs runtime separation** — The Databricks App build environment downloads and compiles source code, but browser binaries downloaded during build don't persist to the runtime container.

2. **`npx` not in PATH** — First fix attempt used `npx playwright install chromium` in a `prestart` npm script. The App runtime environment has `npm` and `node` but `npx` is NOT available (`sh: 1: npx: not found`). The prestart silently fell through to the error fallback.

## Solution: Two-Layer Runtime Install

### Layer 1: `prestart` npm script (package.json)

```json
"prestart": "playwright install chromium 2>&1 | tail -5 || echo '[playwright] Browser install failed at prestart'"
```

* Uses `playwright` directly (not `npx`) — npm adds `node_modules/.bin/` to PATH for lifecycle scripts
* Runs before every `npm run start` invocation
* Non-blocking on failure (falls through to lazy-init)
* Downloads ~112 MiB in ~9 seconds on App compute

### Layer 2: Lazy-init in `browser-controller.ts`

```typescript
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

function getPlaywrightCliPath(): string {
  const playwrightDir = dirname(require.resolve('playwright/package.json'));
  return join(playwrightDir, 'cli.js');
}

function installChromium(): void {
  const cliPath = getPlaywrightCliPath();
  execSync(`${process.execPath} ${cliPath} install chromium`, {
    stdio: 'inherit',
    timeout: 120_000,
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || '/tmp/pw-browsers' },
  });
}
```

* Resolves CLI path via `createRequire` — no PATH dependency
* Uses `process.execPath` for the Node.js binary — no shell lookup needed
* Called from `launch()` only if `chromium.executablePath()` throws
* 2-minute timeout for download

### Environment Variables (app.yaml)

```yaml
- name: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD
  value: '1'
- name: PLAYWRIGHT_BROWSERS_PATH
  value: '/tmp/pw-browsers'
```

* `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` prevents the redundant download attempt during `npm install` at build time (only affects Playwright's own postinstall hook, not the explicit `playwright install` CLI command)
* `PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers` ensures a writable install location in the container

## Verification

| Check | Result |
|-------|--------|
| prestart executed | `playwright install chromium` ran successfully |
| Download completed | Chrome Headless Shell 147.0.7727.15 (112 MiB, ~9s) |
| Install location | `/tmp/pw-browsers/chromium_headless_shell-1217` |
| App startup | Server running on 0.0.0.0:8000, all subsystems initialized |

## Files Modified

* `sc-auditor-app/package.json` — Added `prestart` script
* `sc-auditor-app/app.yaml` — Added `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` and `PLAYWRIGHT_BROWSERS_PATH` env vars
* `sc-auditor-app/server/plugins/browser-agent/browser-controller.ts` — Added lazy-init with programmatic CLI resolution

## Key Insight: Databricks App Runtime Environment

| Binary | Available? | Notes |
|--------|-----------|-------|
| `node` | Yes | Used to run the app |
| `npm` | Yes | Used for lifecycle scripts (`npm run start`) |
| `npx` | **No** | Not in PATH; don't use in npm scripts |
| `node_modules/.bin/*` | Yes (in npm scripts) | npm adds to PATH for lifecycle scripts |
| `/tmp/` | Writable | Suitable for browser binary storage |
