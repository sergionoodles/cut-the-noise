const PRICE_SOURCE = String.raw`(?<prefix>[$€]\s*)?(?<int>\d{1,3}(?:[.,]\d{3})+|\d+)(?<decSep>[.,])(?<frac>\d{2})(?!\d)(?<suffix>\s*[€$])?`;

const ROUND_TO_HALF_SMALL = new Set(["49", "48"]);

const ROUNDED_ATTR = "data-ctn-price-rounded";

const EXCLUDED_PATH = new RegExp(
  [
    String.raw`gp/cart`,
    String.raw`cart/view`,
    String.raw`/cart`,
    String.raw`checkout`,
    String.raw`gp/buy`,
    String.raw`gp/gss`,
    String.raw`gp/orc`,
    String.raw`order-history`,
    String.raw`your-orders`,
    String.raw`css/order`,
    String.raw`order-details`,
    String.raw`css/summary`,
    String.raw`returns/order`,
    String.raw`your-account`,
    String.raw`/ap/`,
  ].join("|"),
  "i",
);

function groupThousands(value: number, sep: string): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/**
 * Rewrites charm prices in a string. Prices of 100 and above round up to the
 * next hundred (dropping decimals); below 100, 90-99 decimals round up to the
 * next integer and 49/48 decimals round up to .50. Thousand separators follow
 * the price locale and currency placement is preserved.
 * Only currency-anchored prices ($ prefix or $/€ affix) are touched so bare
 * numbers like ratings are left alone.
 */
export function roundPriceText(text: string): string {
  if (!text) return text;
  const pattern = new RegExp(PRICE_SOURCE, "g");
  return text.replace(pattern, (...args: unknown[]) => {
    const match = args[0] as string;
    const groups = (args.at(-1) ?? {}) as {
      prefix?: string;
      int?: string;
      decSep?: string;
      frac?: string;
      suffix?: string;
    };
    const { prefix = "", int = "", decSep = "", frac = "", suffix = "" } = groups;
    if (!int || !decSep || !/^\d{2}$/.test(frac)) return match;
    if (!prefix && !suffix) return match;

    const intValue = Number.parseInt(int.replace(/[.,]/g, ""), 10);
    const fracValue = Number.parseInt(frac, 10);
    if (!Number.isFinite(intValue) || !Number.isFinite(fracValue)) return match;
    const sep = decSep === "," ? "." : ",";

    if (intValue >= 100) {
      if (frac === "00" && intValue % 100 === 0) return match;
      const rounded = Math.floor(intValue / 100) * 100 + 100;
      return `${prefix}${groupThousands(rounded, sep)}${suffix}`;
    }

    if (fracValue >= 90) {
      return `${prefix}${groupThousands(intValue + 1, sep)}${suffix}`;
    }

    if (ROUND_TO_HALF_SMALL.has(frac)) {
      return `${prefix}${int}${decSep}50${suffix}`;
    }

    return match;
  });
}

/**
 * Rounding applies on listing/product pages only. Cart, checkout and
 * order/account pages are excluded.
 */
export function shouldRoundPricesForUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return !EXCLUDED_PATH.test(parsed.pathname);
}

const originalSource = new WeakMap<Element, string>();
const originalOffscreen = new WeakMap<Element, string>();
const originalVisualHtml = new WeakMap<Element, string>();
const lastRoundedSource = new WeakMap<Element, string>();
const originalText = new WeakMap<Text, string>();
const lastRoundedText = new WeakMap<Text, string>();

function priceContainersIn(root: Element): Element[] {
  const found = root.matches(".a-price") ? [root] : [];
  return found.concat(Array.from(root.querySelectorAll(".a-price")));
}

function liveSource(offscreen: Element | null, visual: Element | null): string {
  const offscreenText = offscreen?.textContent ?? "";
  // Some Amazon templates leave .a-offscreen blank and only render the
  // split visible price (whole + decimal + fraction + symbol).
  if (offscreenText.trim()) return offscreenText;
  return visual?.textContent ?? "";
}

function applyToPriceContainer(container: Element): void {
  const offscreen = container.querySelector(".a-offscreen");
  const visual = container.querySelector('[aria-hidden="true"]');
  if (!offscreen && !visual) return;

  const current = liveSource(offscreen, visual);
  if (!current.trim()) return;

  const stored = originalSource.get(container);
  const lastRounded = lastRoundedSource.get(container);
  if (stored !== undefined && current !== stored && current !== lastRounded) {
    // Amazon replaced the price in place (e.g. variant change).
    originalSource.set(container, current);
    if (offscreen) originalOffscreen.set(container, offscreen.textContent ?? "");
    if (visual) originalVisualHtml.set(container, visual.innerHTML);
  }
  if (!originalSource.has(container)) {
    originalSource.set(container, current);
    if (offscreen) originalOffscreen.set(container, offscreen.textContent ?? "");
    if (visual) originalVisualHtml.set(container, visual.innerHTML);
  }

  const original = originalSource.get(container) ?? current;
  const rounded = roundPriceText(original);
  if (rounded === original) {
    restorePriceContainer(container);
    return;
  }

  if (offscreen) offscreen.textContent = rounded;
  if (visual) visual.textContent = rounded;
  lastRoundedSource.set(container, rounded);
  container.setAttribute(ROUNDED_ATTR, "1");
}

function restorePriceContainer(container: Element): void {
  if (!container.hasAttribute(ROUNDED_ATTR)) return;
  const offscreenText = originalOffscreen.get(container);
  const visualHtml = originalVisualHtml.get(container);
  const offscreen = container.querySelector(".a-offscreen");
  const visual = container.querySelector('[aria-hidden="true"]');
  if (offscreenText !== undefined && offscreen) offscreen.textContent = offscreenText;
  if (visualHtml !== undefined && visual) visual.innerHTML = visualHtml;
  container.removeAttribute(ROUNDED_ATTR);
  lastRoundedSource.delete(container);
}

function shouldSkipTextNode(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  if (!node.textContent?.trim()) return true;
  if (parent.closest(".a-price")) return true;
  if (parent.closest("script, style, textarea, input, select, option, code, pre, svg")) {
    return true;
  }
  return Boolean(parent.isContentEditable || parent.closest('[contenteditable="true"]'));
}

function applyToTextNode(node: Text): void {
  if (shouldSkipTextNode(node)) return;
  const current = node.textContent ?? "";

  const stored = originalText.get(node);
  const lastRounded = lastRoundedText.get(node);
  if (stored !== undefined && current !== stored && current !== lastRounded) {
    originalText.set(node, current);
  }
  if (!originalText.has(node)) originalText.set(node, current);

  const original = originalText.get(node) ?? current;
  const rounded = roundPriceText(original);
  if (rounded !== original && rounded !== current) {
    lastRoundedText.set(node, rounded);
    node.textContent = rounded;
  } else if (rounded === original && current !== original) {
    node.textContent = original;
    lastRoundedText.delete(node);
  }
}

/** Rounds charm prices under root (split .a-price markup + plain price text). */
export function applyPriceRounding(root: Element): void {
  for (const container of priceContainersIn(root)) applyToPriceContainer(container);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) applyToTextNode(node);
}

/** Restores prices previously rounded under root. */
export function resetPriceRounding(root: Element): void {
  const rounded = root.matches(`[${ROUNDED_ATTR}]`) ? [root] : [];
  for (const container of rounded.concat(Array.from(root.querySelectorAll(`[${ROUNDED_ATTR}]`)))) {
    restorePriceContainer(container);
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const original = originalText.get(node);
    if (original !== undefined && node.textContent !== original) {
      node.textContent = original;
    }
    lastRoundedText.delete(node);
  }
}
