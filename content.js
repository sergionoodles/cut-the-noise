(() => {
  "use strict";

  // ── Default settings ──────────────────────────────────────────────────
  const DEFAULTS = {
    enabled: true,
    replacement: "",
    keywords: "",
    rules: [
      { term: "Breaking", scope: "anywhere" },
      { term: "Breaking News", scope: "anywhere" },
    ],
    ignoreCase: true,
    collapseAds: true,
    tintAds: true,
  };

  let settings = { ...DEFAULTS };
  let observer = null;

  // WeakMap to preserve original text per text node so re-processing
  // always starts from the pre-modification value (avoids double-replacement).
  const originals = new WeakMap();
  const AD_CELL_ATTR = "data-cut-the-noise-ad-cell";
  const AD_TINT_ATTR = "data-cut-the-noise-ad-tint";
  const AD_ARTICLE_ATTR = "data-cut-the-noise-ad-article";
  const AD_STYLE_ID = "cut-the-noise-ad-style";

  // ── Helpers ───────────────────────────────────────────────────────────

  function normalizeRules(rawRules) {
    if (Array.isArray(rawRules)) {
      return rawRules
        .map((rule) => ({
          term: typeof rule?.term === "string" ? rule.term.trim() : "",
          scope: rule?.scope === "start" ? "start" : "anywhere",
        }))
        .filter((rule) => rule.term.length >= 3);
    }

    if (typeof settings.keywords === "string" && settings.keywords.trim()) {
      return settings.keywords
        .split(",")
        .map((term) => ({ term: term.trim(), scope: "anywhere" }))
        .filter((rule) => rule.term.length >= 3);
    }

    return DEFAULTS.rules.map((rule) => ({ ...rule }));
  }

  function getRules() {
    return normalizeRules(settings.rules);
  }

  function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function buildPattern(rule, consumeTail) {
    const escaped = escapeRegex(rule.term);
    const wordPrefix =
      rule.scope === "start" ? "^\\s*" : "(?<![\\p{L}\\p{N}_])";
    const wordSuffix = "(?![\\p{L}\\p{N}_])";
    const suffix = consumeTail ? "(?:[\\p{P}\\s]+)?" : "";
    return `${wordPrefix}${escaped}${wordSuffix}${suffix}`;
  }

  function shouldProcess(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return false;
    const txt = node.textContent;
    if (!txt || !txt.trim()) return false;
    const parent = node.parentElement;
    if (!parent) return false;
    const tag = parent.tagName ? parent.tagName.toLowerCase() : "";
    if (
      [
        "script",
        "style",
        "textarea",
        "input",
        "select",
        "option",
        "code",
        "pre",
      ].includes(tag)
    )
      return false;
    if (parent.closest && parent.closest("svg")) return false;
    if (
      parent.isContentEditable ||
      (parent.closest && parent.closest('[contenteditable="true"]'))
    )
      return false;
    return true;
  }

  function ensureAdStyles() {
    if (document.getElementById(AD_STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = AD_STYLE_ID;
    style.textContent = `
      [${AD_CELL_ATTR}="true"] {
        overflow: hidden !important;
        max-height: 66px !important;
        filter: grayscale(0.75) saturate(0.4) !important;
        border-bottom-color: rgb(47, 51, 54);
        border-bottom-width: 1px;
        border-radius: 0px !important;
      }

      [${AD_TINT_ATTR}="true"] {
        background: rgb(86 8 8 / 75%) !important;
      }

      [${AD_CELL_ATTR}="true"] [data-testid="placementTracking"] {
        opacity: 0.25 !important;
      }
      
      [${AD_ARTICLE_ATTR}="true"] {
        overflow: hidden !important;
        max-height: 66px !important;
      }
    `;
    document.head.append(style);
  }

  function isAdPost(article) {
    return Boolean(
      article &&
      article.matches?.("article") &&
      article.closest('[data-testid="placementTracking"]'),
    );
  }

  function resetAdCells(container) {
    if (!container?.querySelectorAll) return;

    const cells = container.matches?.(`[${AD_CELL_ATTR}="true"]`)
      ? [container]
      : container.querySelectorAll(`[${AD_CELL_ATTR}="true"]`);

    for (const cell of cells) {
      cell.removeAttribute(AD_CELL_ATTR);
    }

    const tintedCells = container.matches?.(`[${AD_TINT_ATTR}="true"]`)
      ? [container]
      : container.querySelectorAll(`[${AD_TINT_ATTR}="true"]`);

    for (const cell of tintedCells) {
      cell.removeAttribute(AD_TINT_ATTR);
    }

    const articles = container.matches?.(`[${AD_ARTICLE_ATTR}="true"]`)
      ? [container]
      : container.querySelectorAll(`[${AD_ARTICLE_ATTR}="true"]`);

    for (const article of articles) {
      article.removeAttribute(AD_ARTICLE_ATTR);
    }
  }

  function styleAdCells(container) {
    if (!container?.querySelectorAll) return;
    if (!settings.collapseAds && !settings.tintAds) return;

    const articles = container.matches?.("article")
      ? [container]
      : container.querySelectorAll("article");

    for (const article of articles) {
      if (!isAdPost(article)) continue;
      const cell = article.closest('[data-testid="cellInnerDiv"]');
      if (!cell) continue;
      if (settings.collapseAds) {
        cell.setAttribute(AD_CELL_ATTR, "true");
        article.setAttribute(AD_ARTICLE_ATTR, "true");
      } else {
        cell.removeAttribute(AD_CELL_ATTR);
        article.removeAttribute(AD_ARTICLE_ATTR);
      }
      if (settings.tintAds) {
        cell.setAttribute(AD_TINT_ATTR, "true");
      } else {
        cell.removeAttribute(AD_TINT_ATTR);
      }
    }
  }

  // ── Core processing ───────────────────────────────────────────────────

  function processNode(node) {
    if (!shouldProcess(node)) return false;

    const rules = getRules();
    if (!rules.length) return false;

    // Use stored original if available to avoid double-replacement.
    let text = originals.has(node) ? originals.get(node) : node.textContent;
    if (!originals.has(node)) {
      originals.set(node, text);
    }

    const flags = settings.ignoreCase ? "giu" : "gu";
    let modified = false;
    const consumeTail = settings.replacement === "";

    for (const rule of rules) {
      const re = new RegExp(buildPattern(rule, consumeTail), flags);

      const next = text.replace(re, settings.replacement);
      if (next !== text) {
        text = next;
        modified = true;
      }
    }

    if (modified && text !== node.textContent) {
      node.textContent = text;
      return true;
    }
    return false;
  }

  function processContainer(container) {
    if (!settings.enabled) return;
    styleAdCells(container);
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
      false,
    );
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) processNode(n);
  }

  // ── Reset (restore originals) ─────────────────────────────────────────

  function resetNode(node) {
    if (originals.has(node)) {
      node.textContent = originals.get(node);
    }
  }

  function resetContainer(container) {
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
      false,
    );
    const nodes = [];
    while (walker.nextNode()) {
      if (originals.has(walker.currentNode)) nodes.push(walker.currentNode);
    }
    for (const n of nodes) resetNode(n);
  }

  function refreshAll() {
    resetAdCells(document.body);
    resetContainer(document.body);
    processContainer(document.body);
  }

  // ── Settings change handler ───────────────────────────────────────────

  function onSettingsChanged(changed) {
    Object.assign(settings, changed);
    if (!settings.enabled) {
      resetAdCells(document.body);
      resetContainer(document.body);
      chrome.runtime.sendMessage({ type: "disableBadge" });
      return;
    }
    chrome.runtime.sendMessage({ type: "enableBadge" });
    refreshAll();
  }

  // ── MutationObserver ──────────────────────────────────────────────────

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver((mutations) => {
      if (!settings.enabled) return;
      for (const mut of mutations) {
        for (const node of mut.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            processContainer(node);
          } else if (node.nodeType === Node.TEXT_NODE) {
            processNode(node);
          }
        }
        if (
          mut.type === "characterData" &&
          mut.target.nodeType === Node.TEXT_NODE
        ) {
          processNode(mut.target);
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  // ── Initialisation ────────────────────────────────────────────────────

  function init() {
    chrome.storage.sync.get(DEFAULTS, (stored) => {
      settings = { ...DEFAULTS, ...stored };
      ensureAdStyles();

      // Start observer first so we never miss mutations during initial scan.
      startObserver();

      if (settings.enabled) {
        processContainer(document.body);
        chrome.runtime.sendMessage({ type: "enableBadge" });
      }
    });

    // Listen for setting updates from the popup / storage.
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg.type === "settingsUpdated") {
        onSettingsChanged(msg.settings);
        sendResponse({ success: true });
      } else if (msg.type === "getStatus") {
        sendResponse({
          enabled: settings.enabled,
          keywordsCount: getRules().length,
        });
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
