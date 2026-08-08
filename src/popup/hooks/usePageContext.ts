import { useEffect, useState } from "react";

import type { SiteId } from "../../shared/settings";
import { getSiteForUrl } from "../../sites/catalog";

export interface PageContext {
  siteId: SiteId | null;
  connected: boolean;
}

/**
 * Detects which supported site the active tab is on and whether
 * the content script is reachable.
 */
export function usePageContext() {
  const [pageContext, setPageContext] = useState<PageContext>({
    siteId: null,
    connected: false,
  });
  const [activeTabSite, setActiveTabSite] = useState<SiteId | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (cancelled) return;

      const tab = tabs[0];
      const site = getSiteForUrl(tab?.url);
      if (!site || tab?.id === undefined) return;

      setActiveTabSite(site.id);
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: "getStatus" });
        if (!cancelled) {
          setPageContext({
            siteId: site.id,
            connected: response?.siteId === site.id,
          });
        }
      } catch {
        if (!cancelled) {
          setPageContext({ siteId: site.id, connected: false });
        }
      }
    }

    void detect();
    return () => {
      cancelled = true;
    };
  }, []);

  return { pageContext, activeTabSite };
}
