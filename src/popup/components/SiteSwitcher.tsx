import type { AppSettings, SiteId } from "../../shared/settings";
import { listSites } from "../../sites/catalog";
import { BrandIcon } from "./BrandIcon";

interface SiteSwitcherProps {
  selectedSite: SiteId;
  settings: AppSettings;
  onSelect: (siteId: SiteId) => void;
}

export function SiteSwitcher({ selectedSite, settings, onSelect }: SiteSwitcherProps) {
  return (
    <nav className="site-switcher" aria-label="Websites">
      {listSites().map((site) => {
        const selected = selectedSite === site.id;
        const enabled = settings.sites[site.id].enabled;
        const statusLabel = enabled ? "enabled" : "disabled";
        return (
          <button
            type="button"
            className={`site-tab${selected ? " is-selected" : ""}`}
            key={site.id}
            onClick={() => onSelect(site.id)}
            aria-pressed={selected}
            aria-label={`${site.name}, ${statusLabel}`}
            title={`${site.name} · ${statusLabel}`}
          >
            <span className="site-icon-wrap" aria-hidden="true">
              <BrandIcon name={site.icon} />
              <span className={`site-status${enabled ? " is-on" : ""}`} />
            </span>
          </button>
        );
      })}
    </nav>
  );
}
