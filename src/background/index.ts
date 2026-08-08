import { loadSettings, SETTINGS_KEY } from "../shared/settings";
import { getSiteForUrl } from "../sites/catalog";

const ICON_SIZES = [16, 32] as const;
let baseIconPromise: Promise<Record<number, ImageData>> | undefined;
let activeIconPromise: Promise<Record<number, ImageData>> | undefined;

async function buildIcon(showActiveMark: boolean): Promise<Record<number, ImageData>> {
  const response = await fetch(chrome.runtime.getURL("icon128.png"));
  const bitmap = await createImageBitmap(await response.blob());
  const images: Record<number, ImageData> = {};

  for (const size of ICON_SIZES) {
    const canvas = new OffscreenCanvas(size, size);
    const context = canvas.getContext("2d");
    if (!context) continue;
    context.drawImage(bitmap, 0, 0, size, size);

    if (showActiveMark) {
      const radius = Math.max(2.6, size * 0.19);
      context.beginPath();
      context.arc(size - radius - 1, size - radius - 1, radius, 0, Math.PI * 2);
      context.fillStyle = "#4a6fa5";
      context.fill();
      context.lineWidth = Math.max(1, size * 0.08);
      context.strokeStyle = "#f5f4f1";
      context.stroke();
    }

    images[size] = context.getImageData(0, 0, size, size);
  }

  return images;
}

async function updateToolbar(tabId: number): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    const site = getSiteForUrl(tab.url);
    const settings = await loadSettings();
    const isActive = Boolean(site && settings.enabled && settings.sites[site.id].enabled);

    baseIconPromise ??= buildIcon(false);
    activeIconPromise ??= buildIcon(true);
    await chrome.action.setIcon({
      imageData: await (isActive ? activeIconPromise : baseIconPromise),
      tabId,
    });
  } catch {
    // The tab may have closed while its state was being resolved.
  }
}

chrome.tabs.onActivated.addListener(({ tabId }) => void updateToolbar(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") void updateToolbar(tabId);
});
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes[SETTINGS_KEY]) return;
  void chrome.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
      if (tab.id !== undefined) void updateToolbar(tab.id);
    }
  });
});
