# Author: Gemma
# V2 Implementation Plan: Persistent Toggle & Origin Boundary (Validated)

## Goal Description
Currently, when a user arms a tab, the state is saved using the tab's ID. However, if the tab navigates to a new page (or hard reloads), Chrome automatically clears tab-specific action badges, deceiving the user into thinking the extension turned off. Furthermore, the extension currently stays armed under the hood even if the user navigates to a completely different domain (e.g., from `youtube.com` to `malicious-site.com`), which is a security flaw.

This V2 plan resolves these issues with architectural fixes confirmed by our Systems Validation subagent:
1. **Same-Origin Persistence:** If the tab navigates to the same parent URL/origin, the extension stays armed and the "ON" badge is reliably re-applied (even on hard reloads).
2. **Cross-Origin Disarm:** If the tab navigates to a different origin, the extension automatically disarms for safety.
3. **Atomic Storage:** Replaces the monolithic array with atomic per-tab storage keys (`tabGuardArmed_<id>`) to eliminate read-modify-write race conditions when multiple background events fire simultaneously.

> [!IMPORTANT]
> **User Review Required:** This plan changes the internal data structure in `chrome.storage.session`. If an old session is active when the extension updates, previously armed tabs will silently disarm because they use the old array format. This is acceptable for session-level storage, but it is a behavioral change.

## Proposed Changes

### `background.js`
We will migrate storage to isolated keys per tab, mapping to the armed `origin`.

#### [MODIFY] `background.js`
1. **Update Storage Helpers (Atomic Operations):**
   ```javascript
   const getArmedKey = (tabId) => `tabGuardArmed_${tabId}`;

   async function getArmedOrigin(tabId) {
     const key = getArmedKey(tabId);
     const result = await chrome.storage.session.get(key);
     return result[key]; // returns the origin string if armed, undefined otherwise
   }

   async function setArmedOrigin(tabId, origin) {
     await chrome.storage.session.set({ [getArmedKey(tabId)]: origin });
   }

   async function removeArmedOrigin(tabId) {
     await chrome.storage.session.remove(getArmedKey(tabId));
   }
   ```

2. **Update Toggle Logic (`chrome.action.onClicked`):**
   ```javascript
   chrome.action.onClicked.addListener(async (tab) => {
     if (!tab.url) return; // Cannot arm if we can't read the URL

     const origin = await getArmedOrigin(tab.id);
     if (origin) {
       await removeArmedOrigin(tab.id);
       await updateBadge(tab.id, false);
     } else {
       try {
         const newOrigin = new URL(tab.url).origin;
         await setArmedOrigin(tab.id, newOrigin);
         await updateBadge(tab.id, true);
       } catch (e) {
         return; // Unparseable URL (e.g. chrome://), ignore
       }
     }
     await broadcastState(tab.id);
   });
   ```

3. **Handle Navigation & Badge Re-application (`chrome.tabs.onUpdated`):**
   Listen for the `loading` status to catch hard reloads, and use safe URL fallback.
   ```javascript
   chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
     if (changeInfo.status !== 'loading') return;
     
     const armedOrigin = await getArmedOrigin(tabId);
     if (!armedOrigin) return;

     const targetUrl = changeInfo.url || tab.url;
     if (!targetUrl) return;

     try {
       const newOrigin = new URL(targetUrl).origin;
       if (newOrigin === armedOrigin) {
         // Same origin: Chrome cleared the badge on hard navigation, re-apply it.
         await updateBadge(tabId, true);
         await broadcastState(tabId);
       } else {
         // Cross-origin: Disarm for safety.
         await removeArmedOrigin(tabId);
         await updateBadge(tabId, false);
         await broadcastState(tabId);
       }
     } catch (e) {
       // Invalid/Unparseable URL, play it safe and disarm
       await removeArmedOrigin(tabId);
       await updateBadge(tabId, false);
     }
   });
   ```

4. **Update Peripheral Listeners:**
   - **`chrome.tabs.onRemoved`**: `await removeArmedOrigin(tabId);`
   - **`tabguard-get-state` (in `onMessage`)**: `const armedOrigin = await getArmedOrigin(sender.tab.id); sendResponse({ armed: !!armedOrigin, url: sender.tab.url });`
   - **`tabs.onCreated`**: `const armedOrigin = await getArmedOrigin(tab.openerTabId); if (!armedOrigin) return;`

## Verification Plan
1. **Same-Origin Persistence:** Arm Tab Guard on `example.com/page1`. Navigate to `example.com/page2` or hit Refresh. Verify the badge stays "ON" and popups are still blocked.
2. **Cross-Origin Disarm:** Arm Tab Guard on `example.com`. Navigate to `google.com`. Verify the badge disappears and the tab is no longer armed.
3. **Atomic Operations:** Rapidly toggle the extension while refreshing the page to ensure the state doesn't corrupt.
