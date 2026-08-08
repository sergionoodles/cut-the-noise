import { describe, expect, it } from "vitest";

import { createDefaultSettings, resolveSettings, SETTINGS_KEY } from "./settings";

describe("resolveSettings", () => {
  it("preserves an explicitly empty legacy rule list", () => {
    expect(resolveSettings({ enabled: true, rules: [] }).sites.x.text.rules).toEqual([]);
  });

  it("keeps settings isolated by site", () => {
    const stored = createDefaultSettings();
    stored.sites.x.text.rules.push({
      id: "extra",
      term: "sponsored",
      scope: "anywhere",
    });

    const resolved = resolveSettings({ [SETTINGS_KEY]: stored });
    expect(resolved.sites.x.text.rules).toHaveLength(3);
    expect(resolved.sites.amazon.text.rules).toHaveLength(0);
    expect(resolved.sites.google.text.rules).toHaveLength(0);
  });

  it("migrates legacy boolean X filters to promoted mode", () => {
    const resolved = resolveSettings({
      [SETTINGS_KEY]: {
        version: 1,
        enabled: true,
        sites: {
          x: {
            enabled: true,
            text: { enabled: true, ignoreCase: true, replacement: "", rules: [] },
            filters: { compactPromoted: true, tintPromoted: false },
          },
          amazon: {
            enabled: true,
            text: { enabled: false, ignoreCase: true, replacement: "", rules: [] },
            filters: { softenSponsored: true, compactSponsored: false },
          },
        },
      },
    });

    expect(resolved.version).toBe(2);
    expect(resolved.sites.x.filters.promoted).toBe("mute");
    expect(resolved.sites.amazon.filters.sponsored).toBe("mute");
    expect(resolved.sites.amazon.filters.lowRating).toBe("off");
    expect(resolved.sites.amazon.filters.minRating).toBe(4);
    // Missing google site fills from defaults.
    expect(resolved.sites.google.enabled).toBe(true);
    expect(resolved.sites.google.filters.sponsored).toBe("mute");
  });

  it("forces amazon text filter off", () => {
    const resolved = resolveSettings({
      [SETTINGS_KEY]: {
        version: 2,
        enabled: true,
        sites: {
          x: createDefaultSettings().sites.x,
          amazon: {
            enabled: true,
            text: {
              enabled: true,
              ignoreCase: true,
              replacement: "x",
              rules: [{ id: "a", term: "sponsored", scope: "anywhere" }],
            },
            filters: { sponsored: "hide", lowRating: "mute", minRating: 3.5 },
          },
        },
      },
    });

    expect(resolved.sites.amazon.text.enabled).toBe(false);
    expect(resolved.sites.amazon.text.rules).toEqual([]);
    expect(resolved.sites.amazon.filters.sponsored).toBe("hide");
    expect(resolved.sites.amazon.filters.minRating).toBe(3.5);
  });

  it("loads google sponsored mode and forces text filter off", () => {
    const resolved = resolveSettings({
      [SETTINGS_KEY]: {
        version: 2,
        enabled: true,
        sites: {
          x: createDefaultSettings().sites.x,
          amazon: createDefaultSettings().sites.amazon,
          google: {
            enabled: false,
            text: {
              enabled: true,
              ignoreCase: true,
              replacement: "x",
              rules: [{ id: "a", term: "sponsored", scope: "anywhere" }],
            },
            filters: { sponsored: "hide" },
          },
        },
      },
    });

    expect(resolved.sites.google.enabled).toBe(false);
    expect(resolved.sites.google.text.enabled).toBe(false);
    expect(resolved.sites.google.text.rules).toEqual([]);
    expect(resolved.sites.google.filters.sponsored).toBe("hide");
  });
});
