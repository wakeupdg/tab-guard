# Browser Verification Report — OI-003 / OI-004 (Origin Boundary Lock)

**Author:** Cory (Claude Code)
**Date:** 2026-07-18
**Status:** LIVE DOCUMENT — being updated in place as more tests run this session. Check the "Last updated" line below for freshness.
**Last updated:** 2026-07-19, mid-session — extension reloaded (picking up the two pending fixes), re-armed, and verification methodology revised again (§11) after the postMessage-listener approach itself turned out to have a reliability gap distinct from OI-005. **§5 CRITICAL CORRECTION still applies to all of §2 and §6 — those remain UNCONFIRMED until individually re-run under the new methodology.**

**Purpose:** Real-browser verification of the OI-003 (child-tab URL constraint bypass fix) and OI-004 (Origin Boundary Lock / DNR + tab-under protection) implementations, for Gemma's review. Everything under "Confirmed Facts" was directly observed via browser automation this session — tab IDs, URLs, and titles are exact values returned by Chrome, not paraphrased. Everything under "Hypothesis / Inference" is explicitly labeled as such and has NOT been confirmed via direct evidence (e.g. service worker console logs, which this session's tooling cannot access — see Tooling Limitations below). Nothing in this report should be read as "verified" unless it appears under Confirmed Facts.

---

## 1. Environment & Methodology

**Setup (facts):**
- Extension loaded unpacked by the user via `chrome://extensions` (Cory cannot reach this page — see §5).
- A local HTTP server was started by Cory: `python3 -m http.server 8934` in `/Users/dganesh/Documents/tab-guard-extension`, confirmed serving (`curl` to `http://localhost:8934/test.html` returned HTTP 200).
- `test.html` was loaded in Chrome tab **714538389** at `http://localhost:8934/test.html` (not `file://` — avoids the separate "Allow access to file URLs" permission toggle, which also lives on the unreachable `chrome://extensions` page).
- The user manually armed tab 714538389 via the Tab Guard toolbar icon (Cory cannot click browser-chrome UI — see §5). User confirmed this was done ("done").

**Verification methodology (fact, stated for auditability):** "Blocked" is inferred from the *absence* of a new tab appearing in `tabs_context_mcp`'s tab list after a test action. This method was validated before relying on it: the "Open same URL as this tab" control case (expected to succeed) produced a real new tab (714538397) visible in `tabs_context_mcp`, confirming that successful opens are NOT a blind spot for this detection method.

**Current git state (fact, `git status --short` at time of writing):**
```
 M .agentflow/personas/gemma.md
 M .agents/rules/active-persona.md
 M .test_output.log
 M "Open Items.md"
 M background.js
 M content-bridge.js
 M main-world-blocker.js
 M manifest.json
 M test.html
?? "Plans/In Progress/2026-07-18_plan-child-tab-constraints.md"
?? "Plans/In Progress/2026-07-18_plan-origin-boundary-lock.md"
?? adversarial-test.html
```
Nothing has been committed. All testing in this report is against the working tree, not a committed snapshot.

---

## 2. Confirmed Facts — Test Results (`test.html`, OI-003)

| # | Action | Exact observed result | Verdict |
|---|---|---|---|
| Control A | Clicked "Open same URL as this tab" link (target=_blank, href = current tab's own URL) | New tab **714538397** appeared: title "Tab Guard Test Page", url `http://localhost:8934/test.html` (matches parent). Confirmed present in `tabs_context_mcp` output at time of check and in all subsequent checks. | PASS — matches expected "should stay open when armed." Also serves as validation of the test methodology itself (see §1). |
| Control B | Clicked "Open example.com (different URL)" link (target=_blank, href = mismatched origin) | No new tab appeared in `tabs_context_mcp` (checked after a 1-second wait). Only tabs 714538389 and 714538397 present. | PASS — mismatched target=_blank link click was blocked outright at click time (no tab ever created), which is a stronger outcome than "opened then closed." |
| Test 1 | Clicked "window.open('https://mismatched-url.com')" button | No new tab appeared in `tabs_context_mcp`. No console errors (`read_console_messages`, `onlyErrors: true`, empty result). | PASS |
| Test 2 | Clicked "window.open() with no args, then navigate to mismatched URL" button | New tab **714538400** appeared: title "mismatched-url-after-open.com", url `https://mismatched-url-after-open.com/`. Checked again after a 2-second wait — **tab was still present, not closed.** Attempted screenshot of tab 714538400 failed with error: `"Error capturing screenshot: Frame with ID 0 is showing error page"` — confirms the tab is rendering some kind of browser error/interstitial page, but this error message alone does not distinguish a DNR block page from a plain DNS-resolution-failure page. No further visual confirmation of which was obtained. | **FAIL.** Expected: tab closes once it navigates to the mismatched URL, per `background.js`'s `restrictedChildTabs` tracking + `onUpdated` mismatch-close logic. Actual: tab remains open indefinitely (confirmed at +2s; not re-checked at longer intervals before the fix below was applied). |
| Test 3a | Clicked "Form submit via user click" button (form, `target="_blank"`, mismatched `action`) | No new tab appeared in `tabs_context_mcp` (checked after a 1-second wait). | PASS |
| Test 3b | Clicked "Form submit via JS `.submit()`" button (same form, submitted programmatically via `HTMLFormElement.prototype.submit()`, bypassing the `submit` event) | No new tab appeared. | PASS — confirms the `HTMLFormElement.prototype.submit` prototype hook is intercepting JS-invoked submission, not just the event listener. |
| Test 4a | Clicked "Button override formaction + formtarget" (submitter has `formaction`/`formtarget` attributes overriding the form's own, mismatched action) | No new tab appeared. | PASS — confirms `event.submitter.formAction`/`formTarget` are being read and evaluated instead of the form's own (non-matching) attributes. |
| Test 4b | Clicked "Normal submit (form's action, target=_self)" | Tab **714538389 itself navigated** (same tab, no new tab created) to `https://form-action-same-origin.com/?test=` — a non-resolving test domain, confirmed via `tabs_context_mcp` reporting that exact title/url for 714538389 afterward. Screenshot attempt on the resulting page failed (`"Permission denied for this action on this domain"` — a different error string than Test 2's, both consistent with some kind of restricted/error page, not further distinguished). | PASS as "not blocked" (same-tab/`target=_self` submissions are never intercepted by design) — but this **navigated the armed test tab itself away from `test.html`**, which had to be manually re-navigated back (see below) to continue testing. Flagging for whoever edits `test.html` next: this button's side effect on the test page itself is worth knowing about, not a bug in the extension. |
| — | Re-navigated tab 714538389 back to `http://localhost:8934/test.html` (plain `navigate`, not a fresh arm) to continue testing. | Page reloaded to `test.html` successfully; subsequent Test 5 results below confirm the tab was still armed after this navigation (consistent with `broadcastState`'s existing SPA-style re-sync behavior — the tab was never disarmed, only its own on-page URL changed and changed back). | Noted as a fact, not a verdict. |
| Test 5a | Clicked "Relative link (resolves to https://different-origin.com/relative-page)" — page has `<base href="https://different-origin.com/">` in `<head>` | No new tab appeared. | PASS — confirms `document.baseURI`-based resolution (not `location.href`) is correctly picking up the page's own `<base>` tag for link clicks. |
| Test 5b | Clicked "window.open('relative-page') with base href" | No new tab appeared. | PASS — same `<base>`-aware resolution, this time for the `window.open()` interception path. |
| Test 5c | Clicked "Form with relative action (resolves against base)" | No new tab appeared, **and** tab 714538389 did NOT navigate away (still `test.html` afterward) — meaning this specific form used a new-context target (not `target=_self`) and was correctly blocked before any navigation happened. | PASS — confirms `<base>`-aware resolution also applies on the form-submission code path. |

**Tabs still open as of this writing (fact, confirmed via `tabs_context_mcp` immediately before this report was written):**
- 714538389 — `http://localhost:8934/test.html` (the armed test page itself)
- 714538397 — `http://localhost:8934/test.html` (Control A's surviving tab — expected to remain open)
- 714538400 — `https://mismatched-url-after-open.com/` — **the Test 2 failure artifact, still open, not yet cleaned up**

## 3. Test 2 Failure — Root Cause

### 3a. Hypothesis / Inference (NOT directly confirmed via logs — flagged per instruction to separate fact from assumption)

Cory does not have access to the extension's background service worker console in this session (see §5, Tooling Limitations) — no `console.log` output from `background.js` was directly observed at any point. The following is an inference from code review plus the observed black-box behavior in §2, not a confirmed fact:

Before the fix in §3b, `background.js` contained:
```js
function isAmbiguousManualNewTab(url) {
  return !url || url === "chrome://newtab/" || url === "chrome://new-tab-page/";
}
```
used in `chrome.tabs.onCreated` as:
```js
const url = tab.url || tab.pendingUrl;
if (isAmbiguousManualNewTab(url)) return; // never tracked
```
The working assumption at implementation time (recorded in `Open Items.md`'s OI-003 entry and in-code comments) was that a script-initiated blank `window.open()` (no arguments) always reports `tab.pendingUrl === "about:blank"` at the exact instant the `onCreated` event fires, distinct from a manual Cmd+T new tab's start URL. **This assumption was never independently verified against real Chrome behavior before this test.** The hypothesis, based on the observed failure, is that in practice `tab.url`/`tab.pendingUrl` can be empty/falsy (not the literal string `"about:blank"`) at that exact event instant for a script-initiated blank popup — which would cause it to fall into the `!url` branch of `isAmbiguousManualNewTab` and be skipped entirely, never entering `restrictedChildTabs`, meaning the later `onUpdated` mismatch-check has no tracked `parentUrl` to compare against and takes no action. This would fully explain the observed Test 2 behavior. **This has not been confirmed by direct inspection of the actual `tab.url`/`tab.pendingUrl` value Chrome supplied at the `onCreated` event for this specific tab** — no logging or inspection of that value was performed before the code was already changed (see §3b). This is a plausible, evidence-consistent explanation, not a proven one.

### 3b. Fix Applied (fact — this is a code change, not a test result)

`background.js` was edited to:
1. Narrow `isAmbiguousManualNewTab` to only match the two literal chrome-internal strings, removing the `!url` case:
   ```js
   function isAmbiguousManualNewTab(url) {
     return url === "chrome://newtab/" || url === "chrome://new-tab-page/";
   }
   ```
2. Widen the "track as blank" branch condition from `url === "about:blank"` to `!url || url === "about:blank"`, so an empty/falsy start URL is now tracked (same as a literal `"about:blank"` start) rather than skipped.

`node --check background.js` was run after this edit and passed (syntax valid). **This fix has not yet been re-verified against the live extension** — background service workers do not hot-reload from a file save; the user must click the reload icon on Tab Guard's card at `chrome://extensions` (Cory cannot do this — see §5) before Test 2 can be re-run against the new code. As of this writing, that reload has not been confirmed by the user, and Test 2 has not been re-run.

### 3c. Known Risk Introduced by the Fix (not yet tested)

Widening the "trackable" bucket to include empty/falsy start URLs narrows the original anti-false-positive protection this code was designed to provide: if a manually-opened Cmd+T new tab *also* reports an empty/falsy `tab.url`/`tab.pendingUrl` at the same `onCreated` instant (rather than reliably reporting `"chrome://newtab/"` or `"chrome://new-tab-page/"` immediately), it would now be misclassified as a trackable script-initiated popup and could be auto-closed if the user then types an unrelated URL into it — the exact false-positive this code originally existed to prevent (see the pre-existing comment history in `background.js`, predating this session). **This has not been tested.** Cory cannot simulate Cmd+T via the available browser automation tooling (it is a browser-chrome keyboard shortcut, not a page-level event — see §5), so this specific check requires the user to manually test Cmd+T on an armed tab after the extension is reloaded, and report the result.

## 4. OI-004 (`adversarial-test.html`) — Status

**Not yet tested in this session.** No scenario from `adversarial-test.html` (the 8-scenario harness Alex built: clickjacking overlay, timer popup, mouseleave popup, tab-under hijack, `about:blank` + `document.write()`, full-screen iframe overlay, `data:` URL navigation, `blob:` URL navigation) has been executed in the browser yet. This includes the DNR-based child-tab network lock and the JS-layer `Location.prototype.replace`/`.assign`/`href` tab-under protection — both are implemented and self-reviewed (per the earlier code-review passes recorded in `Open Items.md` OI-004) but have zero real-browser verification as of this writing.

## 5. CRITICAL CORRECTION — Armed-State Verification Gap (retracts §2 PASS verdicts and §6 below)

**This section retracts confidence in every PASS verdict recorded in §2, and in the Scenario 1/2 results in §6.** Not because those actions are known to be wrong, but because it is no longer possible to say with confidence that the tab was actually armed while they were performed. Facts, in order:

1. All testing in §2 (Controls A/B, Tests 1–5) relied on a single confirmation from the user early in the session — the word "done" in response to a request to click the toolbar icon — with no further verification of armed state at any point during the ~15 test actions that followed, across multiple same-tab navigations.
2. After navigating tab 714538389 to `adversarial-test.html` and running Scenario 1 (clickjacking overlay) and Scenario 2 (timer popup) — both recorded as "no new tab appeared" — the user asked directly: *"Are you able to verify when tab guard is actually armed and enabled on a tab... I don't see it enabled on the front end on my side?"*
3. To answer this with evidence rather than another assumption, Cory injected an independent `window.addEventListener('message', ...)` listener into tab 714538389 via `javascript_tool`, capturing every `{__tabGuard: true, armed, url}` broadcast the extension's own `content-bridge.js` sends into the page. This is the extension's own internal state, not an inference from click outcomes.
4. The **very first captured broadcast**, timestamped at page-load of `adversarial-test.html` — i.e., before the user was asked to click anything in this verification exchange, and therefore reflecting whatever state the tab was already in from earlier in the session — read:
   ```
   { "armed": false, "url": "http://localhost:8934/adversarial-test.html", "capturedAt": "2026-07-18T23:58:57.045Z" }
   ```
   This directly contradicts the assumption (carried since step 1) that the tab had remained armed throughout.
5. The user then reported clicking the toolbar icon three times, describing the sequence: click 1 "nothing happened," click 2 "ON came on," click 3 "turned off." The listener captured **five** broadcasts total (including the pre-click baseline in point 4), i.e. **four** toggle events, not three:
   ```
   23:58:57.045Z  armed: false   (pre-click baseline)
   23:59:10.264Z  armed: true
   23:59:12.333Z  armed: false   (only 2s after the previous entry)
   23:59:31.852Z  armed: true
   23:59:36.196Z  armed: false
   ```
   The mismatch between 3 reported clicks and 4 captured toggles is unresolved. One plausible reconciliation (not confirmed): the first reported click may have registered as two rapid toggles (the 2-second-apart pair) before the user could observe the badge update. No direct evidence confirms this over other explanations.
6. The user then reported clicking twice more. **No new broadcasts were captured** by the listener for these two additional clicks — the log still ends at the same 5 entries. This was itself informative rather than a dead end: it raised (and subsequently ruled out) the possibility that the clicks were landing on a different tab than 714538389.
7. Asked to visually confirm current state directly (bypassing both the click-outcome inference and the listener), the user provided two screenshots: one confirming "Tab Guard Adversarial Test" is the active/focused tab, and one showing the extension's toolbar icon with **no "ON" badge visible** — i.e., currently unarmed. The full browser tab bar in that screenshot shows exactly three tabs — "Tab Guard Adversarial Test," "Tab Guard Test Page," "mismatched-url-after-open.co..." — matching the three tabIds (714538389, 714538397, 714538400) Cory has been tracking, which rules out the tab-mismatch hypothesis from point 6: the user was on the correct tab.
8. **Conclusion (fact, not hypothesis): as of point 7, tab 714538389 is confirmed unarmed, and there is no confirmed point in the session, after the initial "done," at which armed state was independently verified rather than assumed.** The point-6 anomaly (2 clicks, 0 captured broadcasts) remains unexplained — it may indicate the `chrome.tabs.sendMessage` relay from `background.js` to `content-bridge.js` is not 100% reliable (the code does not retry on failure — see `broadcastState` in `background.js`, which silently swallows `chrome.runtime.lastError`), or it may have another cause. This has not been root-caused.

**Practical consequence:** every PASS verdict in §2, and the Scenario 1/2 entries in §6 below, must be treated as **UNCONFIRMED**, not as evidence the extension works. A "no new tab appeared" result is consistent with either "Tab Guard blocked it" or "the tab was unarmed and nothing was ever going to be blocked in the first place, and something else (or nothing) explains the absence of a new tab." Both are live possibilities for every prior row. Re-testing with continuous, per-action armed-state verification (not a one-time check at the start) is required before any of §2 or §6 can be trusted. This re-testing has not yet been done as of this writing — see §8, Outstanding Items.

## 6. Scenario 1–2 Results (`adversarial-test.html`) — UNCONFIRMED, see §5

These were run before the armed-state gap in §5 was discovered. Recorded here as raw observations only — **do not read the Verdict column as trustworthy; see §5.**

| # | Action | Exact observed result | Verdict (UNCONFIRMED per §5) |
|---|---|---|---|
| Scenario 1 | Clicked "Create full-screen transparent overlay" button, then clicked at page coordinate (700, 450) to trigger the overlay's click-through `window.open()` call | No new tab appeared in `tabs_context_mcp`. `read_console_messages` (unfiltered) returned no messages. Cannot independently confirm the overlay's click handler actually fired — there is no console output or other signal from the page distinguishing "handler fired and was blocked" from "handler never fired." | UNCONFIRMED — armed state during this action is unknown per §5, and the underlying mechanism (whether the overlay's handler even executed) is also not independently confirmed. |
| Scenario 2 | Clicked "Schedule window.open() via setTimeout (3s delay)" button, waited 4 seconds | No new tab appeared in `tabs_context_mcp`. | UNCONFIRMED — same caveats as Scenario 1. |

## 7. Tooling Limitations (facts about this session's methodology, relevant to how much weight to put on any "PASS" above)

Confirmed directly, via actual failed tool calls this session (not assumed in advance):
- **`chrome://extensions` is unreachable by Cory's browser automation.** A `navigate` call to this URL returned: `"Can't interact with browser-internal or unparseable URLs. Navigate to a web page first."` This means: Cory cannot load the unpacked extension, cannot reload it after a code change, cannot toggle "Allow access to file URLs," and cannot open the background service worker's DevTools console — all of these required the user to act manually.
- **The extension's toolbar icon (browser chrome, not page content) is not clickable by Cory.** Screenshots captured via the `computer` tool show only the page viewport (confirmed by inspecting the captured screenshots — no browser toolbar/address bar visible in any of them), not the surrounding browser UI. Arming/disarming a tab is only possible via that icon (this extension has no popup UI, keyboard shortcut, or other exposed control per `manifest.json`), so the user had to arm the test tab manually.
- **No access to the background service worker's console.** `read_console_messages` reads a given tab's own console (page/content-script context), not the extension's separate background service worker context. No `console.log` output from `background.js` has been observed at any point in this session. This directly limits §3a to a hypothesis rather than a confirmed root cause.
- **Cmd+T cannot be simulated.** It is a browser-chrome-level keyboard shortcut; the `computer` tool's `key` action operates within a given tab's page context, not the browser's global shortcut surface. This blocks direct testing of §3c's regression risk.
- **The armed/disarmed state has no page-visible ground truth by default**, only a toolbar badge (browser chrome, unreachable — see above) — this is *why* the §5 gap was possible to begin with. The `javascript_tool`-injected listener (see §5) is the one workaround found this session, but §5 point 6 shows it is not itself fully reliable (2 confirmed clicks produced 0 captured broadcasts, unexplained) — it is the best available signal, not a guaranteed one. Every future test action should have its armed state confirmed via this listener immediately beforehand, not assumed to carry over from a prior check.

## 8. Outstanding Items (not yet done, listed explicitly per the instruction to omit nothing)

- [ ] **Get tab 714538389 to a confirmed-armed state** (currently confirmed OFF per §5 point 7) with dual confirmation: the `javascript_tool` listener reports `armed: true` AND the user visually confirms the toolbar badge, at the same point in time.
- [ ] **Re-run every test in §2 and §6 from scratch** with the listener checked immediately before each individual action, not just once at the start. Do not carry forward any prior PASS verdict.
- [ ] Root-cause the point-6 anomaly from §5 (2 confirmed clicks, 0 captured broadcasts) if possible — may indicate a real reliability gap in `background.js`'s `broadcastState`-to-`content-bridge.js` message relay (no retry on `chrome.runtime.lastError`), which would itself be a finding worth fixing, separate from OI-003/OI-004.
- [ ] Confirm with user whether the extension has been reloaded at `chrome://extensions` since the §3b fix (background.js's blank-tracking fix — still unverified against live code as of this writing).
- [ ] Re-run Test 2 against the reloaded extension; confirm tab 714538400-equivalent now closes.
- [ ] User to manually test Cmd+T on a confirmed-armed tab and report whether the new tab survives (regression check for §3c).
- [ ] Re-run Scenarios 1–2 with confirmed armed state (previous runs are UNCONFIRMED per §5/§6).
- [ ] Run Scenarios 3–8 of `adversarial-test.html` (OI-004): mouseleave popup, tab-under hijack, `about:blank`+`document.write()` (expected to stay open), full-screen iframe overlay, `data:` URL navigation (expected to close), `blob:` URL navigation (expected to stay open) — none run yet.
- [ ] Specifically verify DNR is actually blocking network requests for tracked child tabs (vs. only the JS-layer fallback ever catching them) — current tooling cannot distinguish a DNR block page from a DNS-failure error page by screenshot alone (see Test 2 row in §2); may need `read_network_requests` or another method.
- [ ] Clean up leftover test tabs (714538397, 714538400 and any future artifacts) once testing concludes.

## 9. Confirmed-Armed Baseline Re-established

At `2026-07-19T00:06:28.935Z`, the `javascript_tool` listener captured a new broadcast: `{ "armed": true, "url": "http://localhost:8934/adversarial-test.html" }`, immediately following the user reporting a single toolbar click and the badge showing ON on their end. Both signals agree at the same point in time — this is the first dual-confirmed (listener + user visual) armed state of the session and is treated as the baseline for all re-testing from here forward.

**Re-testing methodology from this point on:** the listener (`window.__tabGuardCaptures` on tab 714538389) will be checked for its latest entry immediately before each individual test action, not just once at the start. Any test result will note the timestamp and armed value of the most recent capture at the time of that action.

## 10. `adversarial-test.html` Re-test Results (confirmed-armed, per-action verified)

All rows below were run with the listener's latest entry confirmed as `armed: true, capturedAt: 2026-07-19T00:06:28.935Z` (no new broadcasts — i.e. no toggle — occurred between the baseline and each of these actions, confirmed via listener re-check after each one) unless otherwise noted.

| # | Action | Exact observed result | Verdict |
|---|---|---|---|
| Scenario 1 (re-test) | Clicked "Create full-screen transparent overlay," then clicked page coordinate (700, 450) | No new tab appeared. Listener re-checked immediately after: still `armed: true`, same timestamp (no toggle occurred during the action). | PASS (confirmed-armed this time) |
| Scenario 2 (re-test) | Clicked "Schedule window.open() via setTimeout (3s delay)," waited 4s | No new tab appeared. Listener re-checked: unchanged. | PASS (confirmed-armed) |
| Scenario 3 (re-test) | Hovered into the red mouseleave box, then hovered out of it | No new tab appeared. Listener re-checked: unchanged. Same caveat as the original Scenario 3 run: no independent signal confirms the `mouseleave` event actually fired from a synthetic hover vs. genuinely not firing at all — absence of a new tab is consistent with either "blocked" or "event never fired." | PASS, with the same handler-firing caveat noted for Scenario 1 |
| Scenario 4 | Clicked "Attempt tab-under hijack" button | **Read the actual source (`adversarial-test.html` lines 120–129) after this produced an ambiguous result.** The handler's first line is `confirm('This will open a decoy tab and redirect the current tab to an evil URL. Proceed?')` — a native blocking JS dialog. Per this session's own operating rules, Cory does not interact with or dismiss such dialogs. No decoy tab appeared and tab 714538389's URL did not change (still `adversarial-test.html`) after the click. | **Not a valid test of the security mechanism.** The `window.open(location.href)` and `window.location.replace(...)` calls are both inside the `if (confirmed)` block, after the `confirm()` call — if the dialog was auto-dismissed as "cancel" (the most likely explanation, since the page's subsequent buttons still responded normally afterward, which a genuinely hung/blocked render thread would not do), `confirmed` is `false` and neither call ever executes. **The tab-under hijack code path was never actually exercised.** This scenario needs a redesign (e.g. remove the `confirm()`, or gate it behind a URL param for automated runs) before it can be tested this way again. Manual testing by a human clicking through the real dialog would still work. |
| Scenario 5 (re-test) | Clicked "Open blank window and inject HTML via document.write()" | New tab **714538403** appeared: title "Injected Content", url `about:blank`. Confirmed still present after a 2-second wait. Listener re-checked: unchanged. | PASS (confirmed-armed) |
| Scenario 6 | Clicked "Create full-screen iframe overlay" | `read_page` (accessibility tree) immediately after the click shows a new element `"Full-screen iframe overlay"` (matching the `iframe.title` set in source line 171) present in the DOM. Listener re-checked: still `armed: true`, unchanged. Per source (lines 154–173), `iframe.src` is set directly — this never goes through `window.open` or any hooked API. | PASS as "unimpeded by design" — the iframe element was created and inserted with no interference, consistent with `sub_frame` being deliberately excluded from DNR (to avoid breaking Stripe/YouTube/reCAPTCHA embeds) and never being intercepted at the JS layer either. Not independently confirmed that the iframe's *contents* actually loaded the mismatched URL (would require network-request inspection, not done) — but DOM-level creation being unimpeded is the relevant claim per the plan, and that part is confirmed. |
| Scenario 7 | Clicked "Open child, then navigate to data: URL" | No new tab appeared, both on a 2-second-wait check and on an immediate (zero-wait) re-click-and-check. **Investigated by reading source** (lines 176–188): `testDataUrlNavigation()` calls `window.open('about:blank')` — the literal **string** `"about:blank"`, not an argument-less call. `main-world-blocker.js`'s `window.open` override, before the fix below, only exempted a **falsy** `url` from the mismatch check (`if (!url) return realOpen(...)`); `"about:blank"` is a truthy string, so it fell through to `isAllowed("about:blank")`, which resolves it via `new URL("about:blank", document.baseURI).href` → `"about:blank"`, compares against `state.url` (the armed page's real URL), finds no match, and returns `null` — **blocking the child window from ever being created.** This is a real, confirmed gap: the frontend's blank-popup exemption didn't cover the explicit-string form, only the omitted-argument form, so the mismatch never reaches `background.js`'s tracking logic at all (which is what this scenario is actually meant to exercise). | **FAIL, root cause confirmed (not just hypothesized) via source inspection.** Fixed in `main-world-blocker.js`: the exemption condition is now `if (!url || url === "about:blank") return realOpen(...)`, matching the equivalent fix already made in `background.js`'s `isAmbiguousManualNewTab` handling. `node --check` passed. **Not yet re-verified against the live extension — requires another reload, not yet confirmed done.** |
| Scenario 8 | Not yet run this pass | `testBlobUrlNavigation()` (source lines 190–205) uses the identical `window.open('about:blank')` pattern as Scenario 7 — expected to hit the exact same frontend gap and be fixed by the same code change. Will re-test after the extension reload for Scenario 7's fix, since testing it against the un-reloaded old code would just reproduce the same known issue for a known reason. | DEFERRED, pending reload |

**Cumulative fix status, both pending the same reload:** (1) `background.js`'s blank-tracking widening from §3b (Test 2 fix), (2) `main-world-blocker.js`'s `about:blank`-string exemption from this section (Scenario 7 fix). Neither has been re-verified against the live extension yet.

## 11. Extension Reload, Re-arm, and a Second Methodology Problem (resolved — direct functional probing adopted)

**Sequence of facts:**
1. User reloaded the extension at `chrome://extensions` (confirmed by the user directly: "Ok I reloaded the extension.").
2. This reset `chrome.storage.session` (armed state), confirmed by the user reporting the badge now showed OFF — consistent with extension reloads clearing session storage.
3. Cory reloaded both open test pages (`adversarial-test.html` on 714538389, `test.html` on 714538397) so their content scripts would reconnect to the newly-reloaded background service worker generation, and re-injected the `javascript_tool` listener on 714538389.
4. User clicked the toolbar icon once and reported the badge now showing ON.
5. The listener captured **zero** broadcasts — not even the one-shot initial-page-load state fetch that had previously always appeared reliably before the reload. Waited and re-checked multiple times (immediately, then after a further 3s), still zero. The user provided a screenshot directly confirming the badge genuinely shows a red "ON" indicator on the correct, active tab (`Tab Guard Adversarial Test`) at this exact time.
6. To determine whether this was a real functional failure (i.e. a live instance of OI-005 — badge says armed, actual enforcement isn't) or a flaw specific to the listener-based verification method itself, Cory ran a **direct functional probe** via `javascript_tool`: called `window.open('https://direct-protection-check.com')` directly and inspected its return value. It returned `null` — **blocked**. A blocked `window.open()` call is only possible if `main-world-blocker.js`'s own internal `state.armed` is `true`, which is only ever set by successfully receiving the same `__tabGuard` postMessage broadcast the external listener was failing to see.
7. **Conclusion: the extension's actual protection is functioning correctly right now.** The zero-captures result in points 5–6 reflects an unresolved reliability gap in Cory's own `javascript_tool`-based listener — most likely because `main-world-blocker.js`'s internal listener is registered synchronously at `document_start`, essentially simultaneously with `content-bridge.js`'s one-shot initial broadcast, while the externally-injected listener arrives via a separate tool round-trip subject to real latency and can miss a one-shot event that already fired. This does not fully explain why the *arm-click* broadcast (which happened well after page load and after the listener was confirmed installed) was also missed — that part remains unexplained — but the direct functional probe is conclusive regardless of the explanation: it tests the actual behavior directly rather than an internal signal.

**Methodology going forward:** the postMessage-listener approach is retired for verification purposes (kept, if desired, only as a supplementary signal, not a trusted one). **Direct functional probing is now primary**: immediately before each round of testing, call `window.open()` with an obviously-mismatched, clearly-fake URL via `javascript_tool` and confirm it returns `null` before trusting any subsequent test result on that page.

**Note for Gemma / OI-005:** this session did *not* end up producing a confirmed live reproduction of OI-005 (the direct probe shows the real mechanism was working throughout the zero-captures period) — but the listener reliability gap found here is a related, separate finding worth being aware of if similar postMessage-based instrumentation is used for future debugging: a listener attached from outside the page's own script execution (e.g. via CDP/automation) cannot be assumed to catch a `document_start`-timed one-shot broadcast the way a content script's own synchronously-registered listener can.
