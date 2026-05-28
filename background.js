// ── Toolbar indicator management ───────────────────────────────────────

const ICON_SIZES = [16, 32];
const ICON_SOURCE_PATH = 'icons/icon128.png';

let baseIconImageDataPromise;
let activeIconImageDataPromise;

function isXUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.hostname === 'x.com' && u.protocol === 'https:';
  } catch {
    return false;
  }
}

async function buildIconImageData(showActiveDot) {
  const res = await fetch(chrome.runtime.getURL(ICON_SOURCE_PATH));
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const imageDataBySize = {};

  for (const size of ICON_SIZES) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    ctx.drawImage(bitmap, 0, 0, size, size);

    if (showActiveDot) {
      const radius = Math.max(2.8, size * 0.2);
      const x = size - radius - 1;
      const y = size - radius - 1;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#1D9BF0';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(1, size * 0.08);
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    }

    imageDataBySize[size] = ctx.getImageData(0, 0, size, size);
  }

  return imageDataBySize;
}

function getBaseIconImageData() {
  if (!baseIconImageDataPromise) {
    baseIconImageDataPromise = buildIconImageData(false);
  }
  return baseIconImageDataPromise;
}

function getActiveIconImageData() {
  if (!activeIconImageDataPromise) {
    activeIconImageDataPromise = buildIconImageData(true);
  }
  return activeIconImageDataPromise;
}

async function setToolbarIndicator(tabId, isActive) {
  const imageData = isActive
    ? await getActiveIconImageData()
    : await getBaseIconImageData();

  await chrome.action.setIcon({ imageData, tabId });
  await chrome.action.setBadgeText({ text: '', tabId });
}

async function updateToolbarIndicator(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (isXUrl(tab.url)) {
      const data = await chrome.storage.sync.get({ enabled: true });
      if (data.enabled) {
        await setToolbarIndicator(tabId, true);
        return;
      }
    }
    await setToolbarIndicator(tabId, false);
  } catch {
    // Tab no longer exists.
  }
}

// ── Tab lifecycle events ──────────────────────────────────────────────

chrome.tabs.onActivated.addListener(({ tabId }) => updateToolbarIndicator(tabId));

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') updateToolbarIndicator(tabId);
});

// ── Storage changes (enabled/disabled from another context) ───────────

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (changes.enabled) {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (typeof tab.id === 'number') updateToolbarIndicator(tab.id);
      }
    });
  }
});

// ── Messaging from content script ─────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender) => {
  const tabId = sender.tab?.id;
  if (!tabId) return;

  if (msg.type === 'enableBadge') {
    setToolbarIndicator(tabId, true);
  } else if (msg.type === 'disableBadge') {
    setToolbarIndicator(tabId, false);
  }
});
