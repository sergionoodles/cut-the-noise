import type { AppSettings, SiteId } from "../../shared/settings";

export interface SiteAdapter {
  id: SiteId;
  matches: (hostname: string) => boolean;
  mountStyles: () => void;
  applyFilters: (root: Element, settings: AppSettings) => void;
  resetFilters: (root: Element) => void;
}

export function elementsMatching(root: Element, selector: string): Element[] {
  const matches = root.matches(selector) ? [root] : [];
  return matches.concat(Array.from(root.querySelectorAll(selector)));
}

export function mountStyle(id: string, css: string): void {
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = css;
  document.head.append(style);
}
