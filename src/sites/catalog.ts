import type { FilterMode, SiteId } from "../shared/settings";
import { RATING_THRESHOLDS } from "../shared/settings";

export const xMatchPatterns = ["https://x.com/*", "https://www.x.com/*"];

export const amazonDomains = [
  "amazon.com",
  "amazon.ca",
  "amazon.co.uk",
  "amazon.de",
  "amazon.fr",
  "amazon.es",
  "amazon.it",
  "amazon.co.jp",
  "amazon.com.au",
  "amazon.in",
  "amazon.com.br",
  "amazon.com.mx",
  "amazon.nl",
  "amazon.se",
  "amazon.pl",
  "amazon.sg",
  "amazon.ae",
  "amazon.sa",
  "amazon.com.be",
  "amazon.com.tr",
  "amazon.co.za",
  "amazon.eg",
  "amazon.ie",
] as const;

/** Common Google Search hostnames (www and bare apex are both matched). */
export const googleDomains = [
  "google.com",
  "google.co.uk",
  "google.de",
  "google.fr",
  "google.es",
  "google.it",
  "google.nl",
  "google.be",
  "google.at",
  "google.ch",
  "google.pl",
  "google.pt",
  "google.se",
  "google.no",
  "google.dk",
  "google.fi",
  "google.ie",
  "google.co.jp",
  "google.co.kr",
  "google.com.au",
  "google.com.br",
  "google.ca",
  "google.com.mx",
  "google.co.in",
  "google.com.sg",
  "google.com.hk",
  "google.com.tw",
  "google.co.nz",
  "google.com.ar",
  "google.com.tr",
  "google.ru",
  "google.com.ua",
  "google.co.za",
  "google.com.sa",
  "google.ae",
  "google.co.il",
  "google.com.eg",
  "google.com.ph",
  "google.co.id",
  "google.com.my",
  "google.co.th",
  "google.com.vn",
  "google.com.pk",
  "google.com.bd",
  "google.com.ng",
  "google.com.pe",
  "google.com.co",
  "google.cl",
] as const;

export const amazonMatchPatterns = amazonDomains.map((domain) => `https://*.${domain}/*`);
export const googleMatchPatterns = googleDomains.map((domain) => `https://*.${domain}/*`);
export const supportedSiteMatches = [
  ...xMatchPatterns,
  ...amazonMatchPatterns,
  ...googleMatchPatterns,
];

export type BrandIconId = "x" | "amazon" | "google";

/** Catalog-driven filter control definitions for the popup. */
export type SiteFilterControl =
  | {
      kind: "mode";
      key: string;
      title: string;
      detail: string;
    }
  | {
      kind: "mode-rating";
      key: string;
      thresholdKey: string;
      title: string;
      detail: string;
      thresholds: readonly { value: number; label: string }[];
    };

export interface SiteMeta {
  id: SiteId;
  name: string;
  icon: BrandIconId;
  domain: string;
  description: string;
  /** Whether word-rewrite rules are available for this site. */
  supportsTextFilter: boolean;
  matches: (hostname: string) => boolean;
  filters: readonly SiteFilterControl[];
}

const ratingThresholds = RATING_THRESHOLDS.map((value) => ({
  value,
  label: `${value}+`,
}));

export const sites: Record<SiteId, SiteMeta> = {
  x: {
    id: "x",
    name: "X",
    icon: "x",
    domain: "x.com",
    description: "Quiet the timeline",
    supportsTextFilter: true,
    matches: (hostname) => hostname === "x.com" || hostname === "www.x.com",
    filters: [
      {
        kind: "mode",
        key: "promoted",
        title: "Promoted posts",
        detail: "Mute or hide ads in the feed.",
      },
    ],
  },
  amazon: {
    id: "amazon",
    name: "Amazon",
    icon: "amazon",
    domain: "amazon.*",
    description: "Clear the storefront",
    supportsTextFilter: false,
    matches: (hostname) => amazonDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    ),
    filters: [
      {
        kind: "mode",
        key: "sponsored",
        title: "Sponsored results",
        detail: "Mute or hide paid products and full-width sponsored sections.",
      },
      {
        kind: "mode",
        key: "highRatingSections",
        title: "High-rating sections",
        detail: "Mute or hide recommendation carousels such as “4 stars and above”.",
      },
      {
        kind: "mode",
        key: "searchMismatch",
        title: "Unrelated products",
        detail: "On keyword searches, mute or hide products whose titles match none of your search words.",
      },
      {
        kind: "mode-rating",
        key: "lowRating",
        thresholdKey: "minRating",
        title: "Low ratings",
        detail: "Mute or hide products below the star threshold.",
        thresholds: ratingThresholds,
      },
    ],
  },
  google: {
    id: "google",
    name: "Google",
    icon: "google",
    domain: "google.*",
    description: "Clear the SERP",
    supportsTextFilter: false,
    matches: (hostname) => googleDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    ),
    filters: [
      {
        kind: "mode",
        key: "sponsored",
        title: "Sponsored results",
        detail: "Mute or hide paid search placements.",
      },
    ],
  },
};

export function getSiteForUrl(url: string | undefined): SiteMeta | null {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    return Object.values(sites).find((site) => site.matches(hostname)) ?? null;
  } catch {
    return null;
  }
}

export function listSites(): SiteMeta[] {
  return Object.values(sites);
}

export function getModeFromFilters(
  filters: Record<string, unknown>,
  key: string,
): FilterMode {
  const value = filters[key];
  if (value === "off" || value === "mute" || value === "hide") return value;
  return "off";
}
