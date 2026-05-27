// ── Badge management ──────────────────────────────────────────────────
// Shows a compact badge on the extension icon when the current tab is X/Twitter
// and the filter is enabled.

const ACTIVE_BADGE_TEXT = '•';

function isXUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (
      (u.hostname === 'x.com' || u.hostname === 'twitter.com') &&
      (u.protocol === 'https:' || u.protocol === 'http:')
    );
  } catch {
    return false;
  }
}

async function updateBadge(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (isXUrl(tab.url)) {
      const data = await chrome.storage.sync.get({ enabled: true });
      if (data.enabled) {
        chrome.action.setBadgeText({ text: ACTIVE_BADGE_TEXT, tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#1D9BF0', tabId });
        return;
      }
    }
    chrome.action.setBadgeText({ text: '', tabId });
  } catch {
    // Tab no longer exists.
  }
}

// ── Tab lifecycle events ──────────────────────────────────────────────

chrome.tabs.onActivated.addListener(({ tabId }) => updateBadge(tabId));

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') updateBadge(tabId);
});

// ── Storage changes (enabled/disabled from another context) ───────────

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (changes.enabled) {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (isXUrl(tab.url)) updateBadge(tab.id);
      }
    });
  }
});

// ── Messaging from content script ─────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender) => {
  const tabId = sender.tab?.id;
  if (!tabId) return;

  if (msg.type === 'enableBadge') {
    chrome.action.setBadgeText({ text: ACTIVE_BADGE_TEXT, tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#1D9BF0', tabId });
  } else if (msg.type === 'disableBadge') {
    chrome.action.setBadgeText({ text: '', tabId });
  }
});
