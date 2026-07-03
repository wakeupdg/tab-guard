// Armed tabIds are persisted in chrome.storage.session so state survives
// the service worker being unloaded/reawakened during a browser session.

const STORAGE_KEY = "armedTabIds";

async function getArmedSet() {
  const { [STORAGE_KEY]: ids = [] } = await chrome.storage.session.get(STORAGE_KEY);
  return new Set(ids);
}

async function setArmedSet(set) {
  await chrome.storage.session.set({ [STORAGE_KEY]: [...set] });
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
});

// A tab is only treated as a popup candidate if it starts with a concrete
// destination URL already (real popups/target=_blank links have this).
// Blank/new-tab-page tabs are never tracked here — Chrome sets openerTabId
// even on manually opened Cmd+T tabs, and those get navigated by the user
// afterward, which would otherwise look identical to a popup resolving.
function isBlankStartUrl(url) {
  return !url || url === "about:blank" || url === "chrome://newtab/" || url === "chrome://new-tab-page/";
}

async function closeIfMismatched(childTabId, openerTabId, url) {
  let openerTab;
  try {
    openerTab = await chrome.tabs.get(openerTabId);
  } catch {
    return;
  }
  if (url !== openerTab.url) {
    try {
      await chrome.tabs.remove(childTabId);
    } catch {
      // tab may already be gone
    }
  }
}

chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.openerTabId == null) return;
  const url = tab.url || tab.pendingUrl;
  if (isBlankStartUrl(url)) return; // ambiguous with a deliberate new tab — skip

  const armed = await getArmedSet();
  if (!armed.has(tab.openerTabId)) return;

  await closeIfMismatched(tab.id, tab.openerTabId, url);
});
