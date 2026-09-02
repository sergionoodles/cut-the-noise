import type { FilterMode } from "../../shared/settings";
import { FILTER_MODES } from "../../shared/settings";

const LABELS: Record<FilterMode, string> = {
  off: "Off",
  mute: "Mute",
  hide: "Hide",
};

interface ThreeWaySwitchProps {
  value: FilterMode;
  label: string;
  onChange: (value: FilterMode) => void;
}

/**
 * Compact segmented control for off / mute / hide.
 * Labels sit under the track in small uppercase type.
 */
export function ThreeWaySwitch({ value, label, onChange }: ThreeWaySwitchProps) {
  const index = FILTER_MODES.indexOf(value);

  return (
    <div className={`mode-switch mode-${value}`} data-mode={value} role="group" aria-label={label}>
      <div className="mode-switch-track">
        <span
          className="mode-switch-thumb"
          style={{ transform: `translateX(${index * 100}%)` }}
          aria-hidden="true"
        />
        {FILTER_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            className={`mode-switch-option${value === mode ? " is-active" : ""}`}
            aria-pressed={value === mode}
            onClick={() => onChange(mode)}
          >
            <span className="sr-only">{LABELS[mode]}</span>
          </button>
        ))}
      </div>
      <div className="mode-switch-labels" aria-hidden="true">
        {FILTER_MODES.map((mode) => (
          <span
            key={mode}
            className={`mode-switch-label${value === mode ? " is-active" : ""}`}
          >
            {LABELS[mode]}
          </span>
        ))}
      </div>
    </div>
  );
}
