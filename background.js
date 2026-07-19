// Armed tabIds and restricted child tabs are persisted in chrome.storage.session
// so state survives the service worker being unloaded/reawakened during a
// browser session. Both are re-read fresh from storage on every event rather
// than cached in a module-level variable — a cached copy would need to be
// hydrated asynchronously on cold start, and a listener firing before that
// hydration resolves would see stale/empty state. Reading storage.session
// directly (fast, in-process for MV3) avoids that race entirely.

const ARMED_KEY = "armedTabIds";
const RESTRICTED_KEY = "restrictedChildTabs";

async function getArmedSet() {
  const { [ARMED_KEY]: ids = [] } = await chrome.storage.session.get(ARMED_KEY);
  return new Set(ids);
}

async function setArmedSet(set) {
  await chrome.storage.session.set({ [ARMED_KEY]: [...set] });
}

async function getRestrictedMap() {
  const { [RESTRICTED_KEY]: entries = [] } = await chrome.storage.session.get(RESTRICTED_KEY);
  return new Map(entries);
}

async function setRestrictedMap(map) {
  await chrome.storage.session.set({ [RESTRICTED_KEY]: [...map] });
}

// Network-layer backstop under the exact-URL JS-layer enforcement above:
// declarativeNetRequest blocks a tab's own main_frame requests to any origin
// other than the one it's locked to, so a hostile redirect never gets to
// render even for an instant — unlike the JS-layer tracking, which can only
// react after a navigation has already committed. This is deliberately
// coarser than the exact-URL checks elsewhere (origin/hostname only, not
// full URL) — DNR can only filter by domain, not path or query.
//
// Each locked tab gets its own rule pair, IDs derived from its tabId so no
// separate ID-allocation bookkeeping is needed: an "allow" rule (higher
// priority) for the locked origin's hostname, and a catch-all "block" rule
// (lower priority) for every other main_frame request on that tab.
function dnrRuleIds(tabId) {
  return { allowId: tabId * 2, blockId: tabId * 2 + 1 };
}

async function addOriginLock(tabId, originUrl) {
  let hostname;
  try {
    hostname = new URL(originUrl).hostname;
  } catch {
    return; // no usable origin to lock to — JS-layer tracking still applies
  }
  const { allowId, blockId } = dnrRuleIds(tabId);
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [allowId, blockId],
    addRules: [
      {
        id: allowId,
        priority: 2,
        action: { type: "allow" },
        condition: { tabIds: [tabId], resourceTypes: ["main_frame"], requestDomains: [hostname] },
      },
      {
        id: blockId,
        priority: 1,
        action: { type: "block" },
        condition: { tabIds: [tabId], resourceTypes: ["main_frame"] },
      },
    ],
  });
}

async function removeOriginLock(tabId) {
  const { allowId, blockId } = dnrRuleIds(tabId);
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [allowId, blockId] });
}

async function updateBadge(tabId, armed) {
  await chrome.action.setBadgeText({ tabId, text: armed ? "ON" : "" });
  if (armed) {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#d33" });
  }
}

async function broadcastState(tabId) {
  const armed = await getArmedSet();
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return;
  }
  chrome.tabs.sendMessage(tabId, {
    type: "tabguard-state-update",
    armed: armed.has(tabId),
    url: tab.url,
  }, () => void chrome.runtime.lastError); // ignore errors for tabs with no content script (e.g. chrome:// pages)
}

chrome.action.onClicked.addListener(async (tab) => {
  const armed = await getArmedSet();
  if (armed.has(tab.id)) {
    armed.delete(tab.id);
    await updateBadge(tab.id, false);
  } else {
    armed.add(tab.id);
    await updateBadge(tab.id, true);
  }
  await setArmedSet(armed);
  await broadcastState(tab.id);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "tabguard-get-state" && sender.tab) {
    (async () => {
      const armed = await getArmedSet();
      sendResponse({ armed: armed.has(sender.tab.id), url: sender.tab.url });
    })();
    return true; // keep channel open for async sendResponse
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const armed = await getArmedSet();
  if (armed.delete(tabId)) {
    await setArmedSet(armed);
  }
  const restricted = await getRestrictedMap();
  if (restricted.delete(tabId)) {
    await setRestrictedMap(restricted);
  }
  await removeOriginLock(tabId);
});

// Keep the armed tab's "allowed URL" in sync as it navigates — including
// same-document SPA navigations (history.pushState/hash changes), which
// don't re-run content scripts and would otherwise leave the in-page
// blocker comparing against a stale URL until the user manually retoggled.
//
// Also enforces the restricted-child-tab constraint here: this is where a
// blank-started popup's actual destination first becomes observable (once
// it navigates away from about:blank), and where a tracked child navigating
// away from its allowed URL later — e.g. a follow-up script redirect —
// gets caught.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!changeInfo.url) return;

  const armed = await getArmedSet();
  if (armed.has(tabId)) {
    await broadcastState(tabId);
  }

  const restricted = await getRestrictedMap();
  const parentUrl = restricted.get(tabId);
  if (parentUrl === undefined) return;
  if (changeInfo.url === parentUrl) return;
  if (changeInfo.url.startsWith("blob:")) return; // client-side generated downloads — never closed

  try {
    await chrome.tabs.remove(tabId);
  } catch {
    // tab may already be gone
  }
});

// A tab is only treated as a popup candidate if its opener is armed.
// openerTabId is set by Chrome both for real script-initiated popups
// (window.open, target=_blank links, form submits) *and* for the user's
// own manually-opened new tab (Cmd+T) — which would otherwise look
// identical to a popup resolving. We distinguish the two by start URL: a
// manual new tab starts at the real new-tab-page URL; a script-initiated
// blank popup (window.open() called with no argument) starts blank too, but
// as either the literal "about:blank" or, empirically (confirmed via live
// testing — a same-tick chrome.tabs.onCreated read can catch the tab before
// Chrome has populated even that default), an empty/absent url. Only the
// unambiguous chrome://newtab/ / chrome://new-tab-page/ strings are treated
// as the manual-new-tab case now; blank/empty is treated as a trackable
// script-initiated popup, not skipped — a real bug found by testing this in
// an actual browser rather than by reasoning about the API in the abstract.
function isAmbiguousManualNewTab(url) {
  return url === "chrome://newtab/" || url === "chrome://new-tab-page/";
}

chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.openerTabId == null) return;

  const armed = await getArmedSet();
  if (!armed.has(tab.openerTabId)) return;

  const url = tab.url || tab.pendingUrl;
  if (isAmbiguousManualNewTab(url)) return; // Cmd+T-style — never tracked, see comment above

  let openerTab;
  try {
    openerTab = await chrome.tabs.get(tab.openerTabId);
  } catch {
    return;
  }

  if (!url || url === "about:blank") {
    // Can't evaluate a blank tab yet — track it so a follow-up programmatic
    // navigation (e.g. a popup handle's w.location.href = ...) gets caught
    // by the onUpdated listener above once it resolves to a real URL. DNR
    // is also armed immediately so a network-level redirect gets blocked
    // outright instead of waiting for the reactive close.
    const restricted = await getRestrictedMap();
    restricted.set(tab.id, openerTab.url);
    await setRestrictedMap(restricted);
    await addOriginLock(tab.id, openerTab.url);
    return;
  }

  if (url !== openerTab.url) {
    try {
      await chrome.tabs.remove(tab.id);
    } catch {
      // tab may already be gone
    }
    return;
  }

  // Matches now, but keep enforcing — the child could still be redirected
  // away from the allowed URL by a later script action.
  const restricted = await getRestrictedMap();
  restricted.set(tab.id, openerTab.url);
  await setRestrictedMap(restricted);
  await addOriginLock(tab.id, openerTab.url);
});
