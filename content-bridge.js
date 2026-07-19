// Bridges the extension's armed-state (kept in the background service worker)
// into the page's MAIN world, where main-world-blocker.js can act on it
// synchronously without needing chrome.* API access.
// Also runs a lightweight scan (in this ISOLATED world, which shares the DOM
// with the page) to strip obvious fake-dialog/scareware overlays while armed.

let armed = false;

function pushState(state) {
  armed = !!state.armed;
  window.postMessage({ __tabGuard: true, armed: state.armed, url: state.url }, "*");
  if (armed) startOverlayWatch();
  else stopOverlayWatch();
}

chrome.runtime.sendMessage({ type: "tabguard-get-state" }, (response) => {
  if (response) pushState(response);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === "tabguard-state-update") {
    pushState(message);
  }
});

// --- Scareware overlay removal -------------------------------------------

const SCAM_PATTERNS = [
  /not a robot/i,
  /please confirm you are/i,
  /secure (and )?safe browser/i,
  /click allow/i,
  /verify you('re| are) (a )?human/i,
  /vpn integrated/i,
];

function looksLikeScamOverlay(el) {
  if (!(el instanceof Element)) return false;
  const style = window.getComputedStyle(el);
  if (style.position !== "fixed" && style.position !== "sticky") return false;
  const z = parseInt(style.zIndex, 10);
  if (!Number.isFinite(z) || z < 999) return false;
  const rect = el.getBoundingClientRect();
  const viewportArea = window.innerWidth * window.innerHeight;
  const elArea = rect.width * rect.height;
  if (elArea < viewportArea * 0.02) return false; // ignore tiny fixed widgets (e.g. cookie banners' close buttons)
  const text = el.innerText || "";
  return SCAM_PATTERNS.some((re) => re.test(text));
}

function sweepForScamOverlays() {
  if (!armed) return;
  // Only check direct children of body/html — scam overlays are almost always
  // top-level fixed-position containers, not deeply nested content.
  const candidates = document.body ? Array.from(document.body.children) : [];
  for (const el of candidates) {
    if (looksLikeScamOverlay(el)) {
      el.remove();
    }
  }
}

// Meta-refresh is a declarative navigation mechanism — it never calls any JS
// function, so it's invisible to the location.replace/assign/href hooks in
// main-world-blocker.js. Stripping the tag closes that gap for the common
// case, but isn't airtight: this content script runs at document_start, but
// the "armed" flag only becomes true after an async round-trip to the
// background service worker (see chrome.runtime.sendMessage below) — a
// same-document `content="0;url=..."` refresh baked into the initial HTML
// could in principle fire before that response lands. A delayed refresh
// (content="N;..." for any N>0) is always caught; an immediate one usually
// is too, but this is a best-effort mitigation, not a guarantee.
function stripMetaRefresh() {
  if (!armed) return;
  const metas = document.querySelectorAll('meta[http-equiv="refresh" i]');
  for (const meta of metas) {
    meta.remove();
  }
}

let observer = null;
let intervalId = null;
let metaObserver = null;

function startOverlayWatch() {
  // Runs first and independently of document.body readiness — <head>, where
  // meta-refresh tags live, can exist before <body> is parsed.
  stripMetaRefresh();
  if (!metaObserver && document.documentElement) {
    metaObserver = new MutationObserver(() => stripMetaRefresh());
    metaObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (observer || !document.body) return;
  sweepForScamOverlays();
  observer = new MutationObserver(() => sweepForScamOverlays());
  observer.observe(document.body, { childList: true });
  intervalId = setInterval(sweepForScamOverlays, 1500); // catches restyled/re-shown existing nodes
}

function stopOverlayWatch() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (metaObserver) {
    metaObserver.disconnect();
    metaObserver = null;
  }
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    if (armed) startOverlayWatch();
  });
}
