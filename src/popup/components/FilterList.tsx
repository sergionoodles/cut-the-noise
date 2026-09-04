import type { FilterMode } from "../../shared/settings";
import type { SiteFilterControl } from "../../sites/catalog";
import { getModeFromFilters } from "../../sites/catalog";
import { ThreeWaySwitch } from "./ThreeWaySwitch";
import { Toggle } from "./Toggle";

interface FilterListProps {
  filters: readonly SiteFilterControl[];
  values: Record<string, unknown>;
  onModeChange: (key: string, value: FilterMode) => void;
  onThresholdChange: (key: string, value: number) => void;
  onBooleanChange: (key: string, value: boolean) => void;
}

export function FilterList({
  filters,
  values,
  onModeChange,
  onThresholdChange,
  onBooleanChange,
}: FilterListProps) {
  return (
    <ul className="filter-list">
      {filters.map((filter) => {
        if (filter.kind === "toggle") {
          const checked = values[filter.key] === true;
          return (
            <li className={`filter-row${checked ? " is-active" : ""}`} key={filter.key}>
              <div className="filter-main">
                <div className="filter-copy">
                  <strong>{filter.title}</strong>
                  <span>{filter.detail}</span>
                </div>
                <Toggle
                  checked={checked}
                  label={filter.title}
                  onChange={(next) => onBooleanChange(filter.key, next)}
                />
              </div>
            </li>
          );
        }

        const mode = getModeFromFilters(values, filter.key);
        const active = mode !== "off";

        return (
          <li className={`filter-row${active ? " is-active" : ""}`} key={filter.key}>
            <div className="filter-main">
              <div className="filter-copy">
                <strong>{filter.title}</strong>
                <span>{filter.detail}</span>
              </div>
              <ThreeWaySwitch
                value={mode}
                label={filter.title}
                onChange={(next) => onModeChange(filter.key, next)}
              />
            </div>

            {filter.kind === "mode-rating" && (
              <div className={`filter-threshold${mode === "off" ? " is-muted" : ""}`}>
                <span className="threshold-label">Below</span>
                <div className="threshold-options" role="group" aria-label="Minimum rating">
                  {filter.thresholds.map((option) => {
                    const selected = Number(values[filter.thresholdKey]) === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`threshold-chip${selected ? " is-selected" : ""}`}
                        aria-pressed={selected}
                        disabled={mode === "off"}
                        onClick={() => onThresholdChange(filter.thresholdKey, option.value)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
