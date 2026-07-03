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

let observer = null;
let intervalId = null;

function startOverlayWatch() {
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
