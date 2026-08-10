export const SETTINGS_KEY = "appSettings";

export type SiteId = "x" | "amazon" | "google";
export type RuleScope = "anywhere" | "start";
export type FilterMode = "off" | "mute" | "hide";

export const FILTER_MODES: readonly FilterMode[] = ["off", "mute", "hide"] as const;

export interface TextRule {
  id: string;
  term: string;
  scope: RuleScope;
}

export interface TextFilterSettings {
  enabled: boolean;
  ignoreCase: boolean;
  replacement: string;
  rules: TextRule[];
}

export interface XFilters {
  /** Promoted / ad posts on the timeline. */
  promoted: FilterMode;
}

export interface AmazonFilters {
  /** Sponsored search placements. */
  sponsored: FilterMode;
  /** Full-width recommendation carousels based on high ratings. */
  highRatingSections: FilterMode;
  /** Products whose titles contain none of the current search words. */
  searchMismatch: FilterMode;
  /** Products rated below minRating. */
  lowRating: FilterMode;
  /** Hide/mute products with rating strictly below this value. */
  minRating: number;
}

export interface GoogleFilters {
  /** Sponsored results on the search results page. */
  sponsored: FilterMode;
}

export interface SiteSettings<TFilters> {
  enabled: boolean;
  text: TextFilterSettings;
  filters: TFilters;
}

export interface AppSettings {
  version: 2;
  enabled: boolean;
  sites: {
    x: SiteSettings<XFilters>;
    amazon: SiteSettings<AmazonFilters>;
    google: SiteSettings<GoogleFilters>;
  };
}

export const RATING_THRESHOLDS = [3, 3.5, 4, 4.5] as const;
export type RatingThreshold = (typeof RATING_THRESHOLDS)[number];

const defaultRules = (): TextRule[] => [
  { id: "breaking", term: "Breaking", scope: "start" },
  { id: "breaking-news", term: "Breaking News", scope: "anywhere" },
];

export function createDefaultSettings(): AppSettings {
  return {
    version: 2,
    enabled: true,
    sites: {
      x: {
        enabled: true,
        text: {
          enabled: true,
          ignoreCase: true,
          replacement: "",
          rules: defaultRules(),
        },
        filters: {
          promoted: "mute",
        },
      },
      amazon: {
        enabled: true,
        // Word quieting is X-only; kept empty/disabled for schema stability.
        text: {
          enabled: false,
          ignoreCase: true,
          replacement: "",
          rules: [],
        },
        filters: {
          sponsored: "mute",
          highRatingSections: "off",
          searchMismatch: "off",
          lowRating: "off",
          minRating: 4,
        },
      },
      google: {
        enabled: true,
        text: {
          enabled: false,
          ignoreCase: true,
          replacement: "",
          rules: [],
        },
        filters: {
          sponsored: "mute",
        },
      },
    },
  };
}

export function isFilterMode(value: unknown): value is FilterMode {
  return value === "off" || value === "mute" || value === "hide";
}

export function normalizeFilterMode(value: unknown, fallback: FilterMode = "off"): FilterMode {
  return isFilterMode(value) ? value : fallback;
}

export function normalizeMinRating(value: unknown, fallback = 4): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  const match = RATING_THRESHOLDS.find((threshold) => threshold === num);
  return match ?? fallback;
}

function normalizeRules(value: unknown): TextRule[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== "object") return [];
    const rule = candidate as Partial<TextRule>;
    const term = typeof rule.term === "string" ? rule.term.trim() : "";
    if (term.length < 3) return [];

    return [{
      id: typeof rule.id === "string" ? rule.id : `rule-${index}-${term}`,
      term,
      scope: rule.scope === "start" ? "start" : "anywhere",
    } satisfies TextRule];
  });
}

function emptyTextSettings(): TextFilterSettings {
  return {
    enabled: false,
    ignoreCase: true,
    replacement: "",
    rules: [],
  };
}

/** Prefer the stronger of two modes (hide > mute > off). */
export function strongerMode(a: FilterMode, b: FilterMode): FilterMode {
  const rank = { off: 0, mute: 1, hide: 2 } as const;
  return rank[a] >= rank[b] ? a : b;
}

function migrateXFilters(raw: unknown): XFilters {
  const defaults = createDefaultSettings().sites.x.filters;
  if (!raw || typeof raw !== "object") return defaults;
  const filters = raw as Record<string, unknown>;

  if (isFilterMode(filters.promoted)) {
    return { promoted: filters.promoted };
  }

  // Legacy booleans → mode
  if (filters.compactPromoted === true || filters.tintPromoted === true) {
    return { promoted: "mute" };
  }
  if (filters.compactPromoted === false && filters.tintPromoted === false) {
    return { promoted: "off" };
  }

  return defaults;
}

function migrateAmazonFilters(raw: unknown): AmazonFilters {
  const defaults = createDefaultSettings().sites.amazon.filters;
  if (!raw || typeof raw !== "object") return defaults;
  const filters = raw as Record<string, unknown>;

  let sponsored = defaults.sponsored;
  if (isFilterMode(filters.sponsored)) {
    sponsored = filters.sponsored;
  } else if (filters.compactSponsored === true) {
    sponsored = "mute";
  } else if (filters.softenSponsored === true) {
    sponsored = "mute";
  } else if (filters.softenSponsored === false && filters.compactSponsored === false) {
    sponsored = "off";
  }

  return {
    sponsored,
    highRatingSections: normalizeFilterMode(
      filters.highRatingSections,
      defaults.highRatingSections,
    ),
    searchMismatch: normalizeFilterMode(filters.searchMismatch, defaults.searchMismatch),
    lowRating: normalizeFilterMode(filters.lowRating, defaults.lowRating),
    minRating: normalizeMinRating(filters.minRating, defaults.minRating),
  };
}

function migrateGoogleFilters(raw: unknown): GoogleFilters {
  const defaults = createDefaultSettings().sites.google.filters;
  if (!raw || typeof raw !== "object") return defaults;
  const filters = raw as Record<string, unknown>;
  return {
    sponsored: normalizeFilterMode(filters.sponsored, defaults.sponsored),
  };
}

function mergeStoredSettings(value: unknown): AppSettings | null {
  if (!value || typeof value !== "object") return null;
  const stored = value as { version?: number; enabled?: boolean; sites?: AppSettings["sites"] };
  if (stored.version !== 1 && stored.version !== 2) return null;
  if (!stored.sites) return null;

  const defaults = createDefaultSettings();
  const storedX = stored.sites.x as Partial<SiteSettings<unknown>> | undefined;
  const storedAmazon = stored.sites.amazon as Partial<SiteSettings<unknown>> | undefined;
  const storedGoogle = stored.sites.google as Partial<SiteSettings<unknown>> | undefined;

  return {
    version: 2,
    enabled: typeof stored.enabled === "boolean" ? stored.enabled : defaults.enabled,
    sites: {
      x: {
        enabled: typeof storedX?.enabled === "boolean" ? storedX.enabled : defaults.sites.x.enabled,
        text: {
          ...defaults.sites.x.text,
          ...(storedX?.text as Partial<TextFilterSettings> | undefined),
          rules: normalizeRules((storedX?.text as TextFilterSettings | undefined)?.rules),
        },
        filters: migrateXFilters(storedX?.filters),
      },
      amazon: {
        enabled: typeof storedAmazon?.enabled === "boolean"
          ? storedAmazon.enabled
          : defaults.sites.amazon.enabled,
        text: emptyTextSettings(),
        filters: migrateAmazonFilters(storedAmazon?.filters),
      },
      google: {
        enabled: typeof storedGoogle?.enabled === "boolean"
          ? storedGoogle.enabled
          : defaults.sites.google.enabled,
        text: emptyTextSettings(),
        filters: migrateGoogleFilters(storedGoogle?.filters),
      },
    },
  };
}

function migrateLegacySettings(storage: Record<string, unknown>): AppSettings {
  const defaults = createDefaultSettings();
  const hasLegacySettings = [
    "enabled",
    "rules",
    "keywords",
    "replacement",
    "ignoreCase",
    "collapseAds",
    "tintAds",
  ].some((key) => key in storage);

  if (!hasLegacySettings) return defaults;

  const hasLegacyRuleSource = Array.isArray(storage.rules)
    || (typeof storage.keywords === "string" && storage.keywords.trim().length > 0);
  const legacyKeywords = typeof storage.keywords === "string"
    ? storage.keywords.split(",").map((term) => ({ term }))
    : [];
  const rules = normalizeRules(storage.rules ?? legacyKeywords);
  const compact = typeof storage.collapseAds === "boolean" ? storage.collapseAds : true;
  const tint = typeof storage.tintAds === "boolean" ? storage.tintAds : true;

  return {
    ...defaults,
    enabled: typeof storage.enabled === "boolean" ? storage.enabled : defaults.enabled,
    sites: {
      ...defaults.sites,
      x: {
        ...defaults.sites.x,
        text: {
          enabled: true,
          ignoreCase: typeof storage.ignoreCase === "boolean" ? storage.ignoreCase : true,
          replacement: typeof storage.replacement === "string" ? storage.replacement : "",
          rules: hasLegacyRuleSource ? rules : defaults.sites.x.text.rules,
        },
        filters: {
          promoted: compact || tint ? "mute" : "off",
        },
      },
    },
  };
}

export async function loadSettings(): Promise<AppSettings> {
  const storage = await chrome.storage.sync.get(null);
  return resolveSettings(storage);
}

export function resolveSettings(storage: Record<string, unknown>): AppSettings {
  return mergeStoredSettings(storage[SETTINGS_KEY]) ?? migrateLegacySettings(storage);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
  await chrome.storage.sync.remove([
    "enabled",
    "rules",
    "keywords",
    "replacement",
    "ignoreCase",
    "collapseAds",
    "tintAds",
    "badgesOnly",
  ]);
}
