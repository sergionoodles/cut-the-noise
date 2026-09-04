import { useEffect, useState } from "react";

import type { FilterMode, SiteId, TextRule } from "../shared/settings";
import { sites } from "../sites/catalog";
import { BrandMark } from "./components/BrandMark";
import { FilterList } from "./components/FilterList";
import { RuleEditor } from "./components/RuleEditor";
import { Section } from "./components/Section";
import { SiteSwitcher } from "./components/SiteSwitcher";
import { Toggle } from "./components/Toggle";
import { usePageContext } from "./hooks/usePageContext";
import { useSettings } from "./hooks/useSettings";

export function App() {
  const { settings, update } = useSettings();
  const { pageContext, activeTabSite } = usePageContext();
  const [selectedSite, setSelectedSite] = useState<SiteId>("x");

  useEffect(() => {
    if (activeTabSite) setSelectedSite(activeTabSite);
  }, [activeTabSite]);

  if (!settings) return <LoadingScreen />;

  const meta = sites[selectedSite];
  const siteSettings = settings.sites[selectedSite];
  const activeOnPage = settings.enabled
    && siteSettings.enabled
    && pageContext.siteId === selectedSite
    && pageContext.connected;

  const statusText = activeOnPage
    ? `Filtering ${meta.name}`
    : pageContext.siteId === selectedSite && pageContext.connected
      ? `${meta.name} is paused`
      : settings.enabled
        ? "Idle"
        : "Off";

  function updateRule(id: string, patch: Partial<TextRule>, immediate = false) {
    update((draft) => {
      const rule = draft.sites[selectedSite].text.rules.find((item) => item.id === id);
      if (rule) Object.assign(rule, patch);
    }, immediate);
  }

  function addRule() {
    const id = crypto.randomUUID();
    update((draft) => {
      draft.sites[selectedSite].text.rules.push({ id, term: "", scope: "anywhere" });
    });
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>(`[data-rule-id="${id}"]`)?.focus();
    });
  }

  function removeRule(id: string) {
    update((draft) => {
      draft.sites[selectedSite].text.rules = draft.sites[selectedSite].text.rules.filter(
        (rule) => rule.id !== id,
      );
    }, true);
  }

  function setFilterMode(key: string, value: FilterMode) {
    update((draft) => {
      const filters = draft.sites[selectedSite].filters as unknown as Record<string, unknown>;
      filters[key] = value;
    }, true);
  }

  function setFilterValue(key: string, value: number) {
    update((draft) => {
      const filters = draft.sites[selectedSite].filters as unknown as Record<string, unknown>;
      filters[key] = value;
    }, true);
  }

  function setFilterBoolean(key: string, value: boolean) {
    update((draft) => {
      const filters = draft.sites[selectedSite].filters as unknown as Record<string, unknown>;
      filters[key] = value;
    }, true);
  }

  return (
    <main className="app">
      <header className="masthead">
        <div className="brand">
          <BrandMark />
          <div className="brand-copy">
            <h1>Cut the Noise</h1>
          </div>
        </div>
        <div className="master-toggle">
          <span className="master-label" aria-hidden="true">
            {settings.enabled ? "On" : "Off"}
          </span>
          <Toggle
            checked={settings.enabled}
            label="Filter all supported sites"
            size="md"
            onChange={(checked) => update((draft) => {
              draft.enabled = checked;
            }, true)}
          />
        </div>
      </header>

      <div className={`status-bar${activeOnPage ? " is-live" : ""}`}>
        <span className="status-dot" aria-hidden="true" />
        <span className="status-text">{statusText}</span>
      </div>

      <SiteSwitcher
        selectedSite={selectedSite}
        settings={settings}
        onSelect={setSelectedSite}
      />

      <section className="site-panel" key={selectedSite}>
        <div className="site-heading">
          <div>
            <p className="site-domain">{meta.domain}</p>
            <h2>{meta.name}</h2>
          </div>
          <Toggle
            checked={siteSettings.enabled}
            label={`Enable ${meta.name}`}
            size="md"
            onChange={(checked) => update((draft) => {
              draft.sites[selectedSite].enabled = checked;
            }, true)}
          />
        </div>

        <Section title="Filters">
          <FilterList
            filters={meta.filters}
            values={siteSettings.filters as unknown as Record<string, unknown>}
            onModeChange={setFilterMode}
            onThresholdChange={setFilterValue}
            onBooleanChange={setFilterBoolean}
          />
        </Section>

        {meta.extraSections.map((section) => (
          <Section title={section.title} key={section.title}>
            <FilterList
              filters={section.controls}
              values={siteSettings.filters as unknown as Record<string, unknown>}
              onModeChange={setFilterMode}
              onThresholdChange={setFilterValue}
              onBooleanChange={setFilterBoolean}
            />
          </Section>
        ))}

        {meta.supportsTextFilter && (
          <Section title="Word quieting">
            <RuleEditor
              text={siteSettings.text}
              onToggle={(enabled) => update((draft) => {
                draft.sites[selectedSite].text.enabled = enabled;
              }, true)}
              onUpdateRule={updateRule}
              onAddRule={addRule}
              onRemoveRule={removeRule}
              onReplacementChange={(value) => update((draft) => {
                draft.sites[selectedSite].text.replacement = value;
              })}
              onIgnoreCaseChange={(value) => update((draft) => {
                draft.sites[selectedSite].text.ignoreCase = value;
              }, true)}
            />
          </Section>
        )}
      </section>

      <footer className="footer">
        <span>
          Runs only in your browser. Nothing is sent to external servers.
        </span>
      </footer>
    </main>
  );
}

function LoadingScreen() {
  return (
    <div className="loading">
      <BrandMark className="loading-mark" />
      <p>Loading</p>
    </div>
  );
}
