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
      const resolved = new URL(targetUrl, location.href).href;
      return resolved === state.url;
    } catch {
      return true; // unparseable target, let the fallback close-after-open logic handle it
    }
  }

  const realOpen = window.open.bind(window);
  window.open = function (url, target, ...rest) {
    // Same-tab navigation targets aren't popups — never block these.
    if (target === "_self" || target === "_parent" || target === "_top") {
      return realOpen(url, target, ...rest);
    }
    if (url && !isAllowed(url)) {
      return null;
    }
    return realOpen(url, target, ...rest);
  };

  function opensNewContext(anchor, event) {
    if (anchor.target === "_blank" || anchor.target === "_new") return true;
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
})();
