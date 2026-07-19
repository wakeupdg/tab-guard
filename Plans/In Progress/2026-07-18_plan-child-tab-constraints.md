# V3 Plan: Enforce Child Tab URL Constraints
**Author:** Gemma (Architect)
**Date:** 2026-07-18

## Objective
Prevent child tabs spawned by a TabGuard-armed tab from escaping the parent tab's URL constraints via blank-start navigation, form submissions, or race conditions.

## Architectural Changes

### 1. Robust Child Tracking without New Permissions (`background.js`)
We will stick with the reactive `tabs` permission model rather than introducing `webNavigation` review overhead. We will maintain the extension's stateless model, relying on fast in-process `chrome.storage.session` reads to avoid hydration lifecycle hazards.
- **Storage:** Introduce a new `chrome.storage.session` key: `restrictedChildTabs` (object/dict mapping `childTabId -> parentUrl`).
- **`onCreated`:** When a tab is created, check if its `openerTabId` is armed. If the parent is armed, write the child tab's ID and the parent's URL into `restrictedChildTabs`. *(Crucially: This must happen even if the child's start URL is blank or pending.)*
- **`onUpdated`:** Use an `await chrome.storage.session.get` read per-event. If the updated tab is in `restrictedChildTabs`, compare `changeInfo.url` against the parent's mapped URL. If it differs, close the tab.
- **`onRemoved`:** Clean up closed tabs from `restrictedChildTabs` to prevent leaks.

### 2. Tightened Frontend Interception (`main-world-blocker.js`)
- **Falsy URLs:** Explicitly reject falsy/empty URLs in `window.open` intercepts.
- **Form Prototype Hooking:** Intercept `HTMLFormElement.prototype.submit` directly. Javascript-invoked `form.submit()` bypasses standard event listeners.
- **Form Submission Parsing:** Intercept `submit` events for user-driven submissions. Account for `event.submitter.formAction` and `event.submitter.formTarget` which can override the base form's attributes.
- **Target Resolution:** Any target that doesn't explicitly resolve to the current context (`_self`, `_parent`, `_top`) must be treated as opening a new context and subjected to the URL constraint.
- **Base URI Fix:** Replace `location.href` with `document.baseURI` when resolving relative URLs (`new URL(url, document.baseURI)`) to account for `<base>` tags overriding the document path.

### 3. Orchestration & Testing
Cory should spawn Alex (Co-working) to build an HTML test harness (extending `test.html`) that verifies:
1. `window.open()` is blocked.
2. Blank-started tabs navigating dynamically are closed.
3. `form.submit()` via JavaScript is intercepted and blocked.
4. `<button formaction="...">` overrides are correctly evaluated.
5. `<base>` tag relative-URL resolutions evaluate correctly against `baseURI`.
