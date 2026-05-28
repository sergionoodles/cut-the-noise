(async () => {
  // ── DOM refs ──────────────────────────────────────────────────────────
  const $enabled = document.getElementById("enabled");
  const $replacement = document.getElementById("replacement");
  const $rules = document.getElementById("rules");
  const $addRule = document.getElementById("addRule");
  const $ignoreCase = document.getElementById("ignoreCase");
  const $collapseAds = document.getElementById("collapseAds");
  const $status = document.getElementById("status");

  // ── Load settings from storage ────────────────────────────────────────
  const defaults = {
    enabled: true,
    replacement: "",
    keywords: "",
    rules: [{ term: "breaking", scope: "start" }],
    ignoreCase: true,
    collapseAds: true,
  };

  let settings;
  try {
    settings = await chrome.storage.sync.get(defaults);
  } catch {
    settings = { ...defaults };
  }

  function normalizeRules(rawRules, legacyKeywords = "") {
    if (Array.isArray(rawRules)) {
      return rawRules
        .map((rule) => ({
          term: typeof rule?.term === "string" ? rule.term.trim() : "",
          scope: rule?.scope === "start" ? "start" : "anywhere",
        }))
        .filter((rule) => rule.term.length >= 3);
    }

    if (typeof legacyKeywords === "string" && legacyKeywords.trim()) {
      return legacyKeywords
        .split(",")
        .map((term) => ({ term: term.trim(), scope: "anywhere" }))
        .filter((rule) => rule.term.length >= 3);
    }

    return defaults.rules.map((rule) => ({ ...rule }));
  }

  settings.rules = normalizeRules(settings.rules, settings.keywords);
  delete settings.keywords;

  function createRuleRow(rule = { term: "", scope: "anywhere" }) {
    const row = document.createElement("div");
    row.className = "rule-row";

    const term = document.createElement("input");
    term.type = "text";
    term.minLength = 3;
    term.placeholder = "Word or phrase";
    term.value = rule.term;
    term.className = "rule-term";

    const scope = document.createElement("select");
    scope.className = "rule-scope";
    scope.innerHTML = [
      '<option value="anywhere">Anywhere</option>',
      '<option value="start">Start</option>',
    ].join("");
    scope.value = rule.scope === "start" ? "start" : "anywhere";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "rule-remove";
    remove.textContent = "Remove";

    row.append(term, scope, remove);
    return row;
  }

  function renderRules(rules) {
    $rules.replaceChildren(...rules.map((rule) => createRuleRow(rule)));
  }

  function readRules() {
    return Array.from($rules.querySelectorAll(".rule-row"))
      .map((row) => ({
        term: row.querySelector(".rule-term").value.trim(),
        scope:
          row.querySelector(".rule-scope").value === "start"
            ? "start"
            : "anywhere",
      }))
      .filter((rule) => rule.term.length >= 3);
  }

  // ── Populate UI ───────────────────────────────────────────────────────
  $enabled.checked = settings.enabled;
  $replacement.value = settings.replacement;
  renderRules(settings.rules);
  $ignoreCase.checked = settings.ignoreCase;
  $collapseAds.checked = settings.collapseAds;

  // ── Save helper ───────────────────────────────────────────────────────
  function readForm() {
    return {
      enabled: $enabled.checked,
      replacement: $replacement.value,
      rules: readRules(),
      ignoreCase: $ignoreCase.checked,
      collapseAds: $collapseAds.checked,
    };
  }

  async function save() {
    const next = readForm();
    // Avoid redundant saves.
    if (deepEqual(next, settings)) return;
    settings = next;
    await chrome.storage.sync.set(settings);
    await chrome.storage.sync.remove(["keywords", "badgesOnly"]);

    // Notify the content script in every active X/Twitter tab
    const tabs = await chrome.tabs.query({
      url: ["https://x.com/*", "https://twitter.com/*"],
    });
    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: "settingsUpdated",
          settings,
        });
      } catch {
        // Content script not available – ignore.
      }
    }
  }

  // ── Update status indicator ───────────────────────────────────────────
  async function updateStatus() {
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const tab = tabs[0];
    if (!tab || !tab.url) {
      setStatus(false);
      return;
    }
    const match =
      tab.url.startsWith("https://x.com") ||
      tab.url.startsWith("https://twitter.com");
    if (!match) {
      setStatus(false);
      return;
    }
    // Try pinging the content script.
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, {
        type: "getStatus",
      });
      if (resp && resp.enabled) {
        setStatus(true, `Active \u2014 ${resp.keywordsCount} rule(s)`);
      } else {
        setStatus(true, "Filter is paused");
      }
    } catch {
      // Not on X/Twitter or script not loaded.
      setStatus(false);
    }
  }

  function setStatus(connected, msg) {
    if (connected) {
      $status.className = "status active";
      $status.textContent = `\u25CF ${msg || "Active on X / Twitter"}`;
    } else {
      $status.className = "status inactive";
      $status.textContent = "\u25CF Not connected to X / Twitter";
    }
  }

  // ── Events ────────────────────────────────────────────────────────────

  // Auto-save on every change (debounced).
  let saveTimer;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 300);
  }

  $enabled.addEventListener("change", scheduleSave);
  $replacement.addEventListener("input", scheduleSave);
  $ignoreCase.addEventListener("change", scheduleSave);
  $collapseAds.addEventListener("change", scheduleSave);
  $addRule.addEventListener("click", () => {
    $rules.append(createRuleRow());
  });
  $rules.addEventListener("input", scheduleSave);
  $rules.addEventListener("change", scheduleSave);
  $rules.addEventListener("click", (event) => {
    if (!event.target.classList.contains("rule-remove")) return;
    event.target.closest(".rule-row")?.remove();
    scheduleSave();
  });

  // ── Init ──────────────────────────────────────────────────────────────
  await updateStatus();

  // Re-check status when the popup regains focus.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) updateStatus();
  });

  // ── Utility ───────────────────────────────────────────────────────────
  function deepEqual(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((key) => {
      if (key === "rules") {
        const left = Array.isArray(a.rules) ? a.rules : [];
        const right = Array.isArray(b.rules) ? b.rules : [];
        return (
          left.length === right.length &&
          left.every(
            (rule, index) =>
              rule.term === right[index]?.term &&
              rule.scope === right[index]?.scope,
          )
        );
      }
      return a[key] === b[key];
    });
  }
})();
