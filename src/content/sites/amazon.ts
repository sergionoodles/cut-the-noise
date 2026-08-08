import type { FilterMode } from "../../shared/settings";
import { strongerMode } from "../../shared/settings";
import { sites } from "../../sites/catalog";
import { elementsMatching, mountStyle, type SiteAdapter } from "./types";

const RESULT_SELECTOR = [
  '[data-component-type="sp-sponsored-result"]',
  '[data-component-type="s-search-result"]',
].join(",");
const SPONSORED_MARKER_SELECTOR = [
  ".puis-sponsored-label-text",
  ".s-sponsored-label-info-icon",
  '[aria-label="Sponsored"]',
  '[data-component-type="sp-sponsored-result"]',
].join(",");
const FILTER_ATTRIBUTE = "data-ctn-amazon";
const STYLE_ID = "ctn-amazon-styles";

function isSponsoredResult(result: Element): boolean {
  return result.matches('[data-component-type="sp-sponsored-result"]')
    || Boolean(result.querySelector(SPONSORED_MARKER_SELECTOR));
}

/**
 * Reads a product's star rating from common Amazon search-result markup.
 * Returns null when no rating can be found.
 */
export function parseProductRating(result: Element): number | null {
  const alt = result.querySelector(".a-icon-alt, .a-icon-star-small .a-icon-alt");
  const fromAlt = parseRatingText(alt?.textContent ?? "");
  if (fromAlt !== null) return fromAlt;

  for (const node of result.querySelectorAll("[aria-label]")) {
    const label = node.getAttribute("aria-label") ?? "";
    if (!/star/i.test(label) && !/out of/i.test(label)) continue;
    const parsed = parseRatingText(label);
    if (parsed !== null) return parsed;
  }

  // Class-based stars: a-star-small-4, a-star-4-5, etc.
  for (const node of result.querySelectorAll('[class*="a-star"]')) {
    const match = node.className.match(/a-star(?:-small)?-(\d)(?:-(\d))?/);
    if (!match) continue;
    const whole = Number(match[1]);
    const fraction = match[2] ? Number(match[2]) / 10 : 0;
    if (Number.isFinite(whole)) return whole + fraction;
  }

  return null;
}

export function parseRatingText(text: string): number | null {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(?:out of|de|von|su|sur)?\s*5/i)
    ?? text.match(/^(\d+(?:[.,]\d+)?)\s*stars?/i);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  if (!Number.isFinite(value) || value < 0 || value > 5) return null;
  return value;
}

function resolveMode(result: Element, sponsored: FilterMode, lowRating: FilterMode, minRating: number): FilterMode {
  let mode: FilterMode = "off";

  if (isSponsoredResult(result) && sponsored !== "off") {
    mode = strongerMode(mode, sponsored);
  }

  if (lowRating !== "off") {
    const rating = parseProductRating(result);
    if (rating !== null && rating < minRating) {
      mode = strongerMode(mode, lowRating);
    }
  }

  return mode;
}

export const amazonAdapter: SiteAdapter = {
  id: "amazon",
  matches: sites.amazon.matches,
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
    const { sponsored, lowRating, minRating } = settings.sites.amazon.filters;

    if (root.hasAttribute(FILTER_ATTRIBUTE) && !root.matches(RESULT_SELECTOR)) {
      root.removeAttribute(FILTER_ATTRIBUTE);
    }

    const results = elementsMatching(root, RESULT_SELECTOR);
    const ancestorResult = root.closest(RESULT_SELECTOR);
    if (ancestorResult && !results.includes(ancestorResult)) results.push(ancestorResult);

    for (const result of results) {
      const mode = resolveMode(result, sponsored, lowRating, minRating);
      if (mode === "off") result.removeAttribute(FILTER_ATTRIBUTE);
      else result.setAttribute(FILTER_ATTRIBUTE, mode);
    }
  },
  resetFilters(root) {
    for (const element of elementsMatching(root, `[${FILTER_ATTRIBUTE}]`)) {
      element.removeAttribute(FILTER_ATTRIBUTE);
    }
  },
};
