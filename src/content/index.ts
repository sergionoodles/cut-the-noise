import { loadSettings, SETTINGS_KEY } from "../shared/settings";
import { getAdapterForHostname } from "./sites/registry";
import type { SiteAdapter } from "./sites/types";
import { rewriteText } from "./text-filter";

const adapter = getAdapterForHostname(location.hostname);

if (adapter) {
  void start(adapter);
}

async function start(siteAdapter: SiteAdapter): Promise<void> {
  let settings = await loadSettings();
  const originals = new WeakMap<Text, string>();
  const lastWrites = new WeakMap<Text, string>();
  const observer = new MutationObserver(handleMutations);

  siteAdapter.mountStyles();
  processRoot(document.body);
  observePage();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || !changes[SETTINGS_KEY]) return;
    void loadSettings().then((nextSettings) => {
      settings = nextSettings;
      refresh();
    });
  });

  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!message || typeof message !== "object") return;
    if ((message as { type?: string }).type !== "getStatus") return;

    const siteSettings = settings.sites[siteAdapter.id];
    sendResponse({
      siteId: siteAdapter.id,
      active: settings.enabled && siteSettings.enabled,
      ruleCount: siteSettings.text.rules.length,
    });
  });

  function isActive(): boolean {
    return settings.enabled && settings.sites[siteAdapter.id].enabled;
  }

  function shouldProcess(node: Text): boolean {
    if (!node.textContent?.trim()) return false;
    const parent = node.parentElement;
    if (!parent) return false;
    if (parent.closest("script, style, textarea, input, select, option, code, pre, svg")) return false;
    return !parent.isContentEditable && !parent.closest('[contenteditable="true"]');
  }

  function processTextNode(node: Text): void {
    if (!shouldProcess(node)) return;

    const current = node.textContent ?? "";
    if (lastWrites.get(node) !== current) originals.set(node, current);
    const original = originals.get(node) ?? current;
    const next = rewriteText(original, settings.sites[siteAdapter.id].text);

    if (next !== current) {
      lastWrites.set(node, next);
      node.textContent = next;
    }
  }

  function processRoot(root: Element): void {
    if (!isActive()) return;
    siteAdapter.applyFilters(root, settings);
    // Word rewrite is only meaningful on text-heavy feeds (currently X).
    if (siteAdapter.id !== "x" || !settings.sites[siteAdapter.id].text.enabled) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) processTextNode(node);
  }

  function resetRoot(root: Element): void {
    siteAdapter.resetFilters(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const original = originals.get(node);
      if (original !== undefined && node.textContent !== original) node.textContent = original;
      lastWrites.delete(node);
    }
  }

  function refresh(): void {
    observer.disconnect();
    resetRoot(document.body);
    processRoot(document.body);
    observePage();
  }

  function observePage(): void {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-label", "class", "data-component-type", "data-testid", "data-text-ad"],
    });
  }

  function handleMutations(mutations: MutationRecord[]): void {
    if (!isActive()) return;
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        const textNode = mutation.target as Text;
        processTextNode(textNode);
        if (textNode.parentElement) {
          siteAdapter.applyFilters(textNode.parentElement, settings);
        }
        continue;
      }
      if (mutation.type === "attributes") {
        siteAdapter.applyFilters(mutation.target as Element, settings);
        continue;
      }
      if (mutation.removedNodes.length > 0 && mutation.target.nodeType === Node.ELEMENT_NODE) {
        siteAdapter.applyFilters(mutation.target as Element, settings);
      }
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          const textNode = node as Text;
          processTextNode(textNode);
          if (textNode.parentElement) {
            siteAdapter.applyFilters(textNode.parentElement, settings);
          }
        }
        if (node.nodeType === Node.ELEMENT_NODE) processRoot(node as Element);
      }
    }
  }
}
