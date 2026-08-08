import { sites } from "../../sites/catalog";
import { elementsMatching, mountStyle, type SiteAdapter } from "./types";

/**
 * Stable Google SERP ad containers. Class names churn; these IDs and
 * commercial-unit hooks have been durable across redesigns.
 */
const AD_BLOCK_SELECTORS = [
  "#tads",
  "#tadsb",
  "#bottomads",
  "[data-text-ad]",
  ".commercial-unit-desktop-top",
  ".commercial-unit-desktop-rhs",
  ".commercial-unit-mobile-top",
  ".cu-container",
  ".pla-unit",
  ".pla-unit-container",
  ".shopping-carousel-pla",
  'div[aria-label="Ads"]',
  'div[aria-label="Ads·"]',
].join(",");

/** Never treat these as ad blocks when climbing from a "Sponsored" label. */
const STOP_IDS = new Set([
  "rso",
  "center_col",
  "rcnt",
  "search",
  "main",
  "appbar",
  "cnt",
  "bres",
  "botstuff",
  "taw",
  "tvcap",
]);

/** Common SERP ad labels (lowercase). English plus frequent locales. */
const SPONSORED_LABELS = new Set([
  "sponsored",
  "ad",
  "ads",
  "anzeige",
  "annonse",
  "annonce",
  "anuncio",
  "sponsorisé",
  "sponsorizzato",
  "gesponsord",
  "patrocinado",
]);

const FILTER_ATTRIBUTE = "data-ctn-google";
const STYLE_ID = "ctn-google-styles";

/**
 * Climb from a label node to a block-level container without swallowing
 * the whole results column.
 */
export function blockAncestor(el: Element): Element {
  let node: Element = el;
  for (let i = 0; i < 14 && node.parentElement; i++) {
    const parent = node.parentElement;
    if (
      parent === document.body
      || parent === document.documentElement
      || STOP_IDS.has(parent.id)
    ) {
      return node;
    }
    node = parent;
  }
  return node;
}

export function isSponsoredLabel(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return SPONSORED_LABELS.has(normalized);
}

/**
 * Collect ad blocks under (or including) root using stable selectors and
 * "Sponsored"/"Ad" label fallbacks for inline cards outside #tads.
 */
export function collectSponsoredBlocks(root: Element): Element[] {
  const found = new Set<Element>();

  for (const el of elementsMatching(root, AD_BLOCK_SELECTORS)) {
    found.add(el);
  }

  const ancestor = root.closest(AD_BLOCK_SELECTORS);
  if (ancestor) found.add(ancestor);

  const labelRoots: Element[] = root.matches("span, div") ? [root] : [];
  labelRoots.push(...Array.from(root.querySelectorAll("span, div[aria-label]")));

  for (const el of labelRoots) {
    if (el.childElementCount > 0) continue;

    const aria = el.getAttribute("aria-label") ?? "";
    const text = el.textContent ?? "";
    if (!isSponsoredLabel(text) && !isSponsoredLabel(aria)) continue;

    // Already covered by a stable container.
    if (el.closest(AD_BLOCK_SELECTORS)) continue;

    found.add(blockAncestor(el));
  }

  return Array.from(found);
}

export const googleAdapter: SiteAdapter = {
  id: "google",
  matches: sites.google.matches,
  mountStyles() {
    mountStyle(STYLE_ID, `
      [${FILTER_ATTRIBUTE}="mute"] {
        opacity: .38 !important;
        filter: grayscale(.82) saturate(.3) !important;
        transition: opacity 180ms ease, filter 180ms ease !important;
      }
      [${FILTER_ATTRIBUTE}="mute"]:hover,
      [${FILTER_ATTRIBUTE}="mute"]:focus-within {
        opacity: .76 !important;
        filter: grayscale(.2) saturate(.72) !important;
      }
      [${FILTER_ATTRIBUTE}="hide"] {
        display: none !important;
      }
    `);
  },
  applyFilters(root, settings) {
    const { sponsored } = settings.sites.google.filters;

    if (sponsored === "off") {
      clearFilterAttributes(root);
      return;
    }

    for (const block of collectSponsoredBlocks(root)) {
      block.setAttribute(FILTER_ATTRIBUTE, sponsored);
    }
  },
  resetFilters(root) {
    clearFilterAttributes(root);
  },
};

function clearFilterAttributes(root: Element): void {
  for (const element of elementsMatching(root, `[${FILTER_ATTRIBUTE}]`)) {
    element.removeAttribute(FILTER_ATTRIBUTE);
  }
  if (root.hasAttribute(FILTER_ATTRIBUTE)) root.removeAttribute(FILTER_ATTRIBUTE);
}
