import { sites } from "../../sites/catalog";
import { elementsMatching, mountStyle, type SiteAdapter } from "./types";

const CELL_ATTRIBUTE = "data-ctn-x-promoted";
const ARTICLE_ATTRIBUTE = "data-ctn-x-article";
const STYLE_ID = "ctn-x-styles";

export const xAdapter: SiteAdapter = {
  id: "x",
  matches: sites.x.matches,
  mountStyles() {
    mountStyle(STYLE_ID, `
      [${CELL_ATTRIBUTE}="mute"] {
        max-height: 68px !important;
        overflow: hidden !important;
        border-bottom: 1px solid rgb(47 51 54) !important;
        filter: grayscale(.72) saturate(.42) !important;
      }
      [${CELL_ATTRIBUTE}="mute"] [data-testid="placementTracking"] {
        opacity: .28 !important;
      }
      [${ARTICLE_ATTRIBUTE}="mute"] {
        max-height: 68px !important;
        overflow: hidden !important;
      }
      [${CELL_ATTRIBUTE}="hide"],
      [${ARTICLE_ATTRIBUTE}="hide"] {
        display: none !important;
      }
    `);
  },
  applyFilters(root, settings) {
    const { promoted } = settings.sites.x.filters;

    if (root.hasAttribute(CELL_ATTRIBUTE) && !root.matches('[data-testid="cellInnerDiv"]')) {
      root.removeAttribute(CELL_ATTRIBUTE);
      for (const article of root.querySelectorAll(`[${ARTICLE_ATTRIBUTE}]`)) {
        article.removeAttribute(ARTICLE_ATTRIBUTE);
      }
    }

    const articles = elementsMatching(root, "article");
    const ancestorArticle = root.closest("article");
    if (ancestorArticle && !articles.includes(ancestorArticle)) articles.push(ancestorArticle);

    for (const article of articles) {
      const cell = article.closest('[data-testid="cellInnerDiv"]');
      if (!cell) continue;

      if (!article.closest('[data-testid="placementTracking"]')) {
        cell.removeAttribute(CELL_ATTRIBUTE);
        article.removeAttribute(ARTICLE_ATTRIBUTE);
        continue;
      }

      if (promoted === "off") {
        cell.removeAttribute(CELL_ATTRIBUTE);
        article.removeAttribute(ARTICLE_ATTRIBUTE);
        continue;
      }

      cell.setAttribute(CELL_ATTRIBUTE, promoted);
      article.setAttribute(ARTICLE_ATTRIBUTE, promoted);
    }
  },
  resetFilters(root) {
    for (const element of elementsMatching(root, `[${CELL_ATTRIBUTE}], [${ARTICLE_ATTRIBUTE}]`)) {
      element.removeAttribute(CELL_ATTRIBUTE);
      element.removeAttribute(ARTICLE_ATTRIBUTE);
    }
  },
};
