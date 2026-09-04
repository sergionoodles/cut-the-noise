import type { FilterMode } from "../../shared/settings";
import { strongerMode } from "../../shared/settings";
import { sites } from "../../sites/catalog";
import { applyPriceRounding, resetPriceRounding, shouldRoundPricesForUrl } from "./amazon-prices";
import { elementsMatching, mountStyle, type SiteAdapter } from "./types";

const PRODUCT_RESULT_SELECTOR = [
  '[data-component-type="sp-sponsored-result"]',
  '[data-component-type="s-search-result"]',
].join(",");
const SECTION_RESULT_SELECTOR =
  '.s-main-slot > .s-result-item:not([data-component-type="s-search-result"])';
const FILTER_TARGET_SELECTOR = `${PRODUCT_RESULT_SELECTOR},${SECTION_RESULT_SELECTOR}`;
const HIGH_RATING_HEADING_SELECTOR = '[id$="_featuredasins-heading"]';
const SPONSORED_MARKER_SELECTOR = [
  ".puis-sponsored-label-text",
  ".s-sponsored-label-info-icon",
  '[aria-label="Sponsored"]',
  '[data-component-type="sp-sponsored-result"]',
].join(",");
const PRODUCT_TITLE_SELECTOR = [
  '[data-cy="title-recipe"] h2',
  "h2 a span",
  "h2 span",
  "h2",
].join(",");
const PRODUCT_TILE_SELECTOR = '[data-cy="title-recipe"]';
const FILTER_ATTRIBUTE = "data-ctn-amazon";
const STYLE_ID = "ctn-amazon-styles";

const SPONSORED_LABELS = new Set([
  "sponsored",
  "gesponsert",
  "sponsorisé",
  "sponsorizzato",
  "patrocinado",
  "gesponsord",
  "sponsorowane",
  "sponsrad",
  "sponsorlu",
  "スポンサー",
  "إعلان",
]);
const HIGH_RATING_LABELS = new Set([
  "4 stars and above",
  "highly rated",
  "4 sterne & mehr",
  "4 sterne und mehr",
  "4 étoiles et plus",
  "4 stelle e oltre",
  "4 stelle o più",
  "4 estrellas o más",
  "4 estrelas ou mais",
  "4 sterren en meer",
  "4 gwiazdki i więcej",
  "4 stjärnor och uppåt",
  "4 yıldız ve üzeri",
  "星4つ以上",
  "4 نجوم وما فوق",
]);

/** Returns normalized words only for Amazon keyword-search result URLs. */
export function getAmazonSearchWords(url: string): string[] {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return [];
  }

  if (!/^\/s(?:\/|$)/.test(parsed.pathname)) return [];
  return wordsIn(parsed.searchParams.get("k") ?? "");
}

function wordsIn(value: string): string[] {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** Whether the product title contains at least one searched word. */
export function productTitleMatchesSearch(result: Element, searchWords: readonly string[]): boolean {
  if (searchWords.length === 0) return true;
  const title = result.querySelector(PRODUCT_TITLE_SELECTOR)?.textContent;
  // Search cards can arrive before their title is hydrated. Keep them visible
  // until there is enough information to make a filtering decision.
  if (!title?.trim()) return true;
  const titleWords = new Set(wordsIn(title));
  return searchWords.some((word) => titleWords.has(word));
}

function isSponsoredResult(result: Element): boolean {
  return result.matches('[data-component-type="sp-sponsored-result"]')
    || Boolean(result.querySelector(SPONSORED_MARKER_SELECTOR));
}

/** Full-width search widgets use different markup than product cards. */
export function isSponsoredSection(section: Element): boolean {
  if (section.classList.contains("AdHolder")) return true;

  const products = section.querySelectorAll(PRODUCT_TILE_SELECTOR);
  const firstProduct = products.item(0);
  return Array.from(section.querySelectorAll("span, a, div")).some((element) => {
    if (element.childElementCount > 0 || !SPONSORED_LABELS.has(normalizeLabel(element))) {
      return false;
    }

    // Section disclosures appear before the carousel's first product. A label
    // buried inside a later tile should not classify the whole mixed widget.
    return products.length <= 1
      || !firstProduct
      || Boolean(element.compareDocumentPosition(firstProduct) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
}

/** Amazon uses a featured-ASIN heading for high-rating carousels and other widgets. */
export function isHighRatingSection(section: Element): boolean {
  const headings = section.matches(HIGH_RATING_HEADING_SELECTOR)
    ? [section]
    : Array.from(section.querySelectorAll(HIGH_RATING_HEADING_SELECTOR));

  return headings.some((heading) => (
    HIGH_RATING_LABELS.has(normalizeLabel(heading))
  ));
}

function normalizeLabel(element: Element): string {
  return (element.textContent ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
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

function resolveProductMode(
  result: Element,
  sponsored: FilterMode,
  searchMismatch: FilterMode,
  lowRating: FilterMode,
  minRating: number,
  searchWords: readonly string[],
): FilterMode {
  let mode: FilterMode = "off";

  if (isSponsoredResult(result) && sponsored !== "off") {
    mode = strongerMode(mode, sponsored);
  }

  if (
    searchMismatch !== "off"
    && searchWords.length > 0
    && !productTitleMatchesSearch(result, searchWords)
  ) {
    mode = strongerMode(mode, searchMismatch);
  }

  if (lowRating !== "off") {
    const rating = parseProductRating(result);
    if (rating !== null && rating < minRating) {
      mode = strongerMode(mode, lowRating);
    }
  }

  return mode;
}

function resolveSectionMode(
  section: Element,
  sponsored: FilterMode,
  highRatingSections: FilterMode,
): FilterMode {
  let mode: FilterMode = "off";

  if (sponsored !== "off" && isSponsoredSection(section)) {
    mode = strongerMode(mode, sponsored);
  }

  if (highRatingSections !== "off" && isHighRatingSection(section)) {
    mode = strongerMode(mode, highRatingSections);
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
    const {
      sponsored,
      highRatingSections,
      searchMismatch,
      lowRating,
      minRating,
      roundPrices,
    } = settings.sites.amazon.filters;
    const searchWords = searchMismatch === "off" ? [] : getAmazonSearchWords(location.href);

    if (root.hasAttribute(FILTER_ATTRIBUTE) && !root.matches(FILTER_TARGET_SELECTOR)) {
      root.removeAttribute(FILTER_ATTRIBUTE);
    }

    const results = elementsMatching(root, FILTER_TARGET_SELECTOR);
    const ancestorResult = root.closest(FILTER_TARGET_SELECTOR);
    if (ancestorResult && !results.includes(ancestorResult)) results.push(ancestorResult);

    for (const result of results) {
      const mode = result.matches(PRODUCT_RESULT_SELECTOR)
        ? resolveProductMode(
            result,
            sponsored,
            searchMismatch,
            lowRating,
            minRating,
            searchWords,
          )
        : resolveSectionMode(result, sponsored, highRatingSections);
      if (mode === "off") result.removeAttribute(FILTER_ATTRIBUTE);
      else result.setAttribute(FILTER_ATTRIBUTE, mode);
    }

    if (roundPrices && shouldRoundPricesForUrl(location.href)) {
      applyPriceRounding(root);
    } else {
      resetPriceRounding(root);
    }
  },
  resetFilters(root) {
    for (const element of elementsMatching(root, `[${FILTER_ATTRIBUTE}]`)) {
      element.removeAttribute(FILTER_ATTRIBUTE);
    }
    resetPriceRounding(root);
  },
};
