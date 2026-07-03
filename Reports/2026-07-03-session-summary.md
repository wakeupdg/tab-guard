# Tab Guard — Session Summary (2026-07-03)

## What this extension is
A local-only (unpacked, not published) Chrome Manifest V3 extension called **Tab Guard**.
Purpose: on a per-tab basis, prevent popup/popunder tabs and in-page scareware overlays
from a site (e.g. shady streaming sites) from interrupting the user — especially the
"exits fullscreen video to open a new tab" annoyance.

Repo: https://github.com/wakeupdg/tab-guard.git (branch `main`)
Local path: `~/Documents/tab-guard-extension/`

## Core behavior
- Click the toolbar icon on a tab to **arm/disarm** it (badge shows "ON" when armed).
  Armed state is per-tabId, stored in `chrome.storage.session` (survives service worker
  unload, resets on browser restart).
- While armed, any new tab whose URL is not **byte-for-byte identical** to the armed
  tab's current URL is blocked/closed. Exact match was a deliberate user choice (not
  origin-only or fragment-insensitive matching).
- Three layers of defense, in order of how early they intervene:
  1. **`main-world-blocker.js`** (MAIN world, `document_start`, all frames) — overrides
     `window.open()` and intercepts clicks that would open a new tab/window
     (`target="_blank"`, ctrl/cmd/shift-click, middle-click), blocking before the browser
     ever creates a tab. This is what actually stops the "exits fullscreen" problem,
     since the fallback layer below can't prevent the initial tab-creation flash.
  2. **`background.js`** `chrome.tabs.onCreated` fallback — closes any tab that slips
     through layer 1, but **only if it already has a concrete destination URL at
     creation** (not blank/`chrome://newtab/`). This exclusion was a critical bug fix —
     see "Bugs fixed" below.
  3. **`content-bridge.js`** scam-overlay sweep — while armed, watches for fixed/sticky,
     high-z-index (>=999), viewport-covering (>2% area) top-level elements whose text
     matches known scareware phrases ("not a robot", "click allow", "secure safe
     browser", "vpn integrated", etc.) and removes them. Runs via MutationObserver +
     1.5s interval poll (site re-inserts these repeatedly).

## File map
- `manifest.json` — MV3 manifest; declares the two content scripts (MAIN + ISOLATED
  worlds) and the `tabs`/`storage` permissions.
- `background.js` — service worker. Owns armed-state storage, action-click toggle,
  badge updates, the onCreated fallback closer, and a message handler
  (`tabguard-get-state` / `tabguard-state-update`) that content-bridge.js uses to learn
  current armed state (including on re-arm, broadcasts to the already-loaded page so it
  takes effect without a reload).
- `main-world-blocker.js` — MAIN-world popup interceptor (see layer 1 above). Receives
  armed state via `window.postMessage` from content-bridge.js (MAIN world scripts have
  no `chrome.*` API access, hence the bridge).
- `content-bridge.js` — ISOLATED-world script. Bridges armed state into MAIN world, and
  independently runs the scam-overlay sweep (layer 3) since DOM removal doesn't need
  MAIN-world access.
- `test.html` — a minimal manual test page (a same-URL link and a different-URL
  `target="_blank"` link) for sanity-checking without needing a real ad-heavy site.
- `icons/` — placeholder solid-red PNG icons (16/48/128), generated programmatically,
  not designed.
- `LICENSE` — GPLv3, auto-added by GitHub when the remote repo was created.

## Bugs found and fixed this session
1. **Click-blocker was too aggressive**: originally intercepted *every* anchor click on
   an armed tab, breaking normal same-tab navigation entirely. Fixed by only blocking
   clicks that would actually open a new context (`target="_blank"`/`_new`, ctrl/cmd/
   shift modifier, middle-click).
2. **`window.open(url, '_self')` wrongly blocked**: some sites use this to navigate the
   *current* tab. Fixed by always allowing `_self`/`_parent`/`_top` targets through.
3. **Fallback closer killed legitimate manually-opened tabs**: Chrome sets
   `openerTabId` even on a Cmd+T new tab if another tab was active at the time — not
   just on real popups. The original code tracked any such tab as a "pending popup"
   until its URL resolved, then closed it if it didn't match the opener — which fired
   the moment the user typed a URL into their own new tab. Fixed by only ever treating
   a new tab as a popup candidate if it starts with a **concrete non-blank URL already**
   at creation time (real popups/`target=_blank` links have this; deliberate new tabs
   start at `chrome://newtab/`). Ambiguous blank-start tabs are never tracked by the
   fallback layer — layer 1 (proactive blocking) is relied on for those cases instead.

## Testing performed
- Manual testing was done live against `https://www.streamex.net/watch/tv/60625?s=9&e=3&server=zxcstream`
  (a site with real ad-injected popups/popunders and fake scareware overlays), used
  with the user's explicit consent for this specific defensive-testing purpose.
- Confirmed: repeated interactions with the video player, including clicking through a
  fake "Secure and Safe Browser / Continue" ad and a fake "Click Allow if you are not a
  robot" CAPTCHA overlay, produced **zero leaked popup tabs** while armed.
- Confirmed: the fake CAPTCHA/scareware overlay (a persistent in-page div, not a real
  tab or native browser dialog — video kept playing behind it) is now auto-removed by
  the layer-3 sweep.
- Not yet tested: behavior specifically in fullscreen video mode (user asked for this
  but the session ended before it was completed) — worth revisiting next session to
  confirm the fullscreen-exit annoyance is fully gone in practice, not just in the
  windowed-mode tests done so far.

## Known limitations / things to watch for next session
- Armed state resets on browser restart (by design — `chrome.storage.session`, not
  persisted to disk). If persistence across restarts becomes desirable, would need
  `chrome.storage.local` instead, with the tradeoff of stale armed tabIds surviving a
  browser restart where those tabIds no longer correspond to real tabs.
- The scam-overlay sweep heuristic is a simple pattern/z-index/size match — it can
  false-positive on legitimate high-z-index fixed UI (rare but possible) and can
  false-negative on scareware phrased differently than the current pattern list. If new
  scam phrasings are seen on other sites, add to `SCAM_PATTERNS` in
  `content-bridge.js`.
- No automated tests exist — all verification so far has been manual (via
  `chrome://extensions` reload + live site interaction, driven partly through the
  Claude-in-Chrome browser extension in this session).
- Icons are placeholders (flat red squares) — cosmetic only, not a functional issue.

## How to pick this back up
1. `cd ~/Documents/tab-guard-extension` — repo is already initialized and pushed to
   `https://github.com/wakeupdg/tab-guard.git` (`main` branch, in sync as of this
   session).
2. Load unpacked via `chrome://extensions` (Developer mode → Load unpacked) if not
   already loaded, or Reload if it is.
3. `test.html` in this repo is the quickest sanity check; the streamex.net URL above is
   the "real world nasty ad site" stress test if deeper verification is needed again.
