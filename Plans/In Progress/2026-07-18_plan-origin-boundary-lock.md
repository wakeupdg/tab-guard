# V3 Plan: Origin Boundary Lock & Adversarial Test Suite
**Author:** Gemma (Architect)
**Date:** 2026-07-18

## Objective
Upgrade TabGuard to enforce an Origin Boundary Lock using `declarativeNetRequest` (DNR) to secure the current armed tab and its children, and build an Adversarial Test Suite to verify its resilience against hostile web patterns.

## 1. Network-Level Origin Lock (`declarativeNetRequest`)
- **DNR Implementation:** Add `declarativeNetRequest` to manifest permissions. Dynamically add a session-scoped DNR rule targeting the armed tab's ID (and its tracked children) using `condition.tabIds`.
- **`main_frame` Only (The Lock):** The rule will block all `main_frame` network requests that do not match the armed Origin. This completely prevents cross-origin hijacks on the current tab (tab-under attacks) without causing redirect loops. **UX Tradeoff Accepted:** Because DNR operates at the network level, it cannot distinguish a malicious script redirect from a user's manual navigation. As a result, the user will be unable to manually navigate the armed tab to a new origin without disarming TabGuard first. This strict lock is necessary because frontend JS hooks (`Location.prototype.replace`) are bypassed by native `Location` own-properties.
- **Sub-frame Exemption:** Do NOT block `sub_frame` requests. Blocking them breaks legitimate web functionality (Stripe, YouTube embeds, reCAPTCHA). The threat model is exclusively `main_frame` escapes.

## 2. Null Origin Fallbacks & Edge Cases
DNR handles standard network requests, but we must handle client-side edge cases via `tabs` tracking:
- **`about:blank` (Allowed):** Continue tracking `about:blank` children but DO NOT close them aggressively. This preserves legitimate `document.write` patterns like "Print Invoice". Only close them if they initiate a follow-up navigation cross-origin.
- **`blob:` URIs (Allowed):** Exempt `blob:` URIs from closure entirely, as they are essential for client-side generated file downloads.
- **`data:` URIs (Blocked):** Actively close tabs attempting to navigate to `data:text/html` (or similar) URIs, as these are common evasion vectors for hiding malicious UI.

## 3. Adversarial Test Suite (`adversarial-test.html`)
Alex (Co-working) will build out the test suite to verify the logic against hostile patterns:
1. **Clickjacking & Timers:** Verify that full-screen transparent overlays and `setTimeout` popups are successfully blocked or closed if they cross the origin boundary.
2. **Current Tab Hijack (Tab-Under):** Execute `window.open(location.href)` followed by `window.location.replace('https://evil.com')`. Verify that DNR successfully blocks the `evil.com` hijack on the parent tab, presenting the Chrome blocked page.
3. **Null Origin Edge Cases:** Verify that `w = window.open('about:blank'); w.document.write(...)` remains open and functional. Verify that `window.open('data:text/html,<h1>Evil</h1>')` is instantly closed.
