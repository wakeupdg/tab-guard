// Runs in the page's own JS context (MAIN world) so it can intercept popup
// attempts before the browser ever creates a tab/window for them.
// State (armed + the exact URL to allow) is pushed in from content-bridge.js
// via postMessage, since MAIN-world scripts have no chrome.* API access.

(function () {
  const state = { armed: false, url: null };

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.__tabGuard !== true) return;
    state.armed = msg.armed;
    state.url = msg.url;
  });

  function isAllowed(targetUrl) {
    if (!state.armed) return true;
    try {
      // document.baseURI, not location.href: a page's own <base> tag changes
      // the correct resolution base for relative URLs, and location.href
      // ignores it.
      const resolved = new URL(targetUrl, document.baseURI).href;
      return resolved === state.url;
    } catch {
      return true; // unparseable target, let the fallback close-after-open logic handle it
    }
  }

  // Any target that doesn't resolve to the current browsing context opens a
  // new one — not just literal "_blank"/"_new". An empty/absent target means
  // "current tab" (never blocked); any other non-self/parent/top value,
  // including an arbitrary name that isn't already an open context, spawns
  // a new tab/window exactly like "_blank" does. Shared by link clicks and
  // form submissions below.
  function targetOpensNewContext(target) {
    return target !== "" && target !== "_self" && target !== "_parent" && target !== "_top";
  }

  const realOpen = window.open.bind(window);
  window.open = function (url, target, ...rest) {
    // Same-tab navigation targets aren't popups — never block these.
    if (target === "_self" || target === "_parent" || target === "_top") {
      return realOpen(url, target, ...rest);
    }
    if (!url || url === "about:blank") {
      // Blank popup — either no destination argument at all, or an explicit
      // "about:blank" string (both mean the same thing; found via testing
      // that window.open('about:blank') was falling through to the mismatch
      // check below and getting blocked outright, unlike window.open() with
      // no argument). Nothing to evaluate here either way — background.js
      // tracks the resulting tab and closes it if a later programmatic
      // navigation (w.location.href = ...) lands on a mismatched URL; this
      // frontend layer can't see that in advance.
      return realOpen(url, target, ...rest);
    }
    if (!isAllowed(url)) {
      return null;
    }
    return realOpen(url, target, ...rest);
  };

  function opensNewContext(anchor, event) {
    if (targetOpensNewContext(anchor.target)) return true;
    if (event.ctrlKey || event.metaKey || event.shiftKey) return true; // forced new-tab modifiers
    if (event.type === "auxclick" && event.button === 1) return true; // middle click
    return false;
  }

  function blockedLinkClick(event) {
    if (!state.armed) return;
    const anchor = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!anchor) return;
    if (!opensNewContext(anchor, event)) return; // let normal same-tab navigation through untouched
    if (!isAllowed(anchor.href)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  document.addEventListener("click", blockedLinkClick, true);
  document.addEventListener("auxclick", blockedLinkClick, true);

  // --- Form submissions -----------------------------------------------
  //
  // A submit button (or input[type=submit]/[type=image]) can override the
  // form's own action/target via formaction/formtarget attributes for that
  // one submission — the effective destination is the submitter's, not
  // necessarily the form's. The formAction IDL property always resolves to
  // an absolute URL (defaulting to the document URL when the attribute is
  // absent), so presence must be checked via hasAttribute, not truthiness.

  function effectiveFormAction(form, submitter) {
    if (submitter && submitter.hasAttribute("formaction")) {
      return submitter.formAction;
    }
    return form.action;
  }

  function effectiveFormTarget(form, submitter) {
    if (submitter && submitter.hasAttribute("formtarget")) {
      return submitter.formTarget;
    }
    return form.target;
  }

  function isSubmissionAllowed(form, submitter) {
    const target = effectiveFormTarget(form, submitter);
    if (!targetOpensNewContext(target)) return true; // same-tab submission — never blocked
    return isAllowed(effectiveFormAction(form, submitter));
  }

  // HTMLFormElement.prototype.submit() bypasses the "submit" event entirely
  // per spec — a JS-invoked form.submit() would never reach the listener
  // below. This is a hard bypass of an event-only approach, not an edge
  // case, so it needs its own intercept.
  const realFormSubmit = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function (...args) {
    if (state.armed && !isSubmissionAllowed(this, null)) {
      return;
    }
    return realFormSubmit.apply(this, args);
  };

  function blockedFormSubmit(event) {
    if (!state.armed) return;
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!isSubmissionAllowed(form, event.submitter || null)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  document.addEventListener("submit", blockedFormSubmit, true);

  // --- Tab-under protection (this tab's own navigation) -----------------
  //
  // window.location.replace()/.assign()/.href = ... are the only ways a
  // page's own script can navigate this tab away from itself — the user's
  // own navigation (address bar, real link clicks, back/forward) never goes
  // through these APIs at all, so hooking them here blocks a malicious
  // self-redirect ("tab-under") without restricting the user's own
  // navigation on this tab in any way.
  //
  // Deliberately origin-only, not exact-URL like isAllowed() above: this
  // guards the tab staying on the SAME SITE, not the same path — blocking
  // same-origin hash/query/path changes here would break completely normal
  // in-page navigation (client-side routers, anchor jumps).
  function isSameOrigin(targetUrl) {
    if (!state.armed || !state.url) return true;
    try {
      const resolved = new URL(targetUrl, document.baseURI);
      const allowed = new URL(state.url);
      return resolved.origin === allowed.origin;
    } catch {
      return true;
    }
  }

  const realLocationReplace = Location.prototype.replace;
  Location.prototype.replace = function (url) {
    if (!isSameOrigin(url)) return;
    return realLocationReplace.call(this, url);
  };

  const realLocationAssign = Location.prototype.assign;
  Location.prototype.assign = function (url) {
    if (!isSameOrigin(url)) return;
    return realLocationAssign.call(this, url);
  };

  const hrefDescriptor = Object.getOwnPropertyDescriptor(Location.prototype, "href");
  if (hrefDescriptor && hrefDescriptor.set && hrefDescriptor.configurable) {
    const realHrefSet = hrefDescriptor.set;
    try {
      Object.defineProperty(Location.prototype, "href", {
        ...hrefDescriptor,
        set(url) {
          if (!isSameOrigin(url)) return;
          realHrefSet.call(this, url);
        },
      });
    } catch {
      // Some engine variance could make this non-patchable — replace()/
      // assign() above still cover the common case either way.
    }
  }
})();
