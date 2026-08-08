import type { SiteId } from "../../shared/settings";
import { amazonAdapter } from "./amazon";
import { googleAdapter } from "./google";
import type { SiteAdapter } from "./types";
import { xAdapter } from "./x";

/**
 * Register site adapters here. Content script picks the first match
 * for the current hostname.
 */
export const siteAdapters: readonly SiteAdapter[] = [xAdapter, amazonAdapter, googleAdapter];

export function getAdapterForHostname(hostname: string): SiteAdapter | undefined {
  return siteAdapters.find((adapter) => adapter.matches(hostname));
}

export function getAdapterById(id: SiteId): SiteAdapter | undefined {
  return siteAdapters.find((adapter) => adapter.id === id);
}
