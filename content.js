(() => {
  'use strict';

  // ── Default settings ──────────────────────────────────────────────────
  const DEFAULTS = {
    enabled: true,
    replacement: '',
    keywords: '',
    rules: [
      { term: 'Breaking', scope: 'anywhere' },
      { term: 'Breaking News', scope: 'anywhere' },
    ],
    ignoreCase: true,
  };

  let settings = { ...DEFAULTS };
  let observer = null;

  // WeakMap to preserve original text per text node so re-processing
  // always starts from the pre-modification value (avoids double-replacement).
  const originals = new WeakMap();

  // ── Helpers ───────────────────────────────────────────────────────────

  function normalizeRules(rawRules) {
    if (Array.isArray(rawRules)) {
      return rawRules
        .map((rule) => ({
          term: typeof rule?.term === 'string' ? rule.term.trim() : '',
          scope: rule?.scope === 'start' ? 'start' : 'anywhere',
        }))
        .filter((rule) => rule.term.length >= 3);
    }

    if (typeof settings.keywords === 'string' && settings.keywords.trim()) {
      return settings.keywords
        .split(',')
        .map((term) => ({ term: term.trim(), scope: 'anywhere' }))
        .filter((rule) => rule.term.length >= 3);
    }

    return DEFAULTS.rules.map((rule) => ({ ...rule }));
  }

  function getRules() {
    return normalizeRules(settings.rules);
  }

  function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function buildPattern(rule, consumeTail) {
    const escaped = escapeRegex(rule.term);
    const wordPrefix = rule.scope === 'start' ? '^\\s*' : '(?<![\\p{L}\\p{N}_])';
    const wordSuffix = '(?![\\p{L}\\p{N}_])';
    const suffix = consumeTail ? '(?:[\\p{P}\\s]+)?' : '';
    return `${wordPrefix}${escaped}${wordSuffix}${suffix}`;
  }

  function shouldProcess(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return false;
    const txt = node.textContent;
    if (!txt || !txt.trim()) return false;
    const parent = node.parentElement;
    if (!parent) return false;
    const tag = parent.tagName ? parent.tagName.toLowerCase() : '';
    if (
      [
        'script', 'style', 'textarea', 'input', 'select', 'option',
        'code', 'pre',
      ].includes(tag)
    )
      return false;
    if (parent.closest && parent.closest('svg')) return false;
    if (
      parent.isContentEditable ||
      (parent.closest && parent.closest('[contenteditable="true"]'))
    )
      return false;
    return true;
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

    const flags = settings.ignoreCase ? 'giu' : 'gu';
    let modified = false;
    const consumeTail = settings.replacement === '';

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
    resetContainer(document.body);
    processContainer(document.body);
  }

  // ── Settings change handler ───────────────────────────────────────────

  function onSettingsChanged(changed) {
    Object.assign(settings, changed);
    if (!settings.enabled) {
      resetContainer(document.body);
      chrome.runtime.sendMessage({ type: 'disableBadge' });
      return;
    }
    chrome.runtime.sendMessage({ type: 'enableBadge' });
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
        if (mut.type === 'characterData' && mut.target.nodeType === Node.TEXT_NODE) {
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

      // Start observer first so we never miss mutations during initial scan.
      startObserver();

      if (settings.enabled) {
        processContainer(document.body);
        chrome.runtime.sendMessage({ type: 'enableBadge' });
      }
    });

    // Listen for setting updates from the popup / storage.
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg.type === 'settingsUpdated') {
        onSettingsChanged(msg.settings);
        sendResponse({ success: true });
      } else if (msg.type === 'getStatus') {
        sendResponse({
          enabled: settings.enabled,
          keywordsCount: getRules().length,
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
