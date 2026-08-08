import type { TextFilterSettings, TextRule } from "../../shared/settings";
import { Toggle } from "./Toggle";

interface RuleEditorProps {
  text: TextFilterSettings;
  onToggle: (enabled: boolean) => void;
  onUpdateRule: (id: string, patch: Partial<TextRule>, immediate?: boolean) => void;
  onAddRule: () => void;
  onRemoveRule: (id: string) => void;
  onReplacementChange: (value: string) => void;
  onIgnoreCaseChange: (value: boolean) => void;
}

export function RuleEditor({
  text,
  onToggle,
  onUpdateRule,
  onAddRule,
  onRemoveRule,
  onReplacementChange,
  onIgnoreCaseChange,
}: RuleEditorProps) {
  return (
    <div className="rule-editor">
      <div className="feature-heading">
        <div className="filter-copy">
          <strong>Rewrite page text</strong>
          <span>Whole words and phrases, processed on your device.</span>
        </div>
        <Toggle
          checked={text.enabled}
          label="Enable word quieting"
          onChange={onToggle}
        />
      </div>

      <div className={`text-controls${text.enabled ? "" : " is-muted"}`}>
        <div className="rules" aria-label="Word rules">
          {text.rules.length === 0 && (
            <div className="empty-rule">
              No rules yet. The page keeps its original words.
            </div>
          )}

          {text.rules.map((rule, index) => (
            <div className="rule-row" key={rule.id}>
              <span className="rule-index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <input
                data-rule-id={rule.id}
                value={rule.term}
                minLength={3}
                placeholder="Word or phrase"
                aria-label={`Rule ${index + 1}`}
                onChange={(event) => onUpdateRule(rule.id, { term: event.target.value })}
              />
              <select
                value={rule.scope}
                aria-label={`Scope for ${rule.term || `rule ${index + 1}`}`}
                onChange={(event) => onUpdateRule(
                  rule.id,
                  { scope: event.target.value === "start" ? "start" : "anywhere" },
                  true,
                )}
              >
                <option value="anywhere">Anywhere</option>
                <option value="start">At start</option>
              </select>
              <button
                className="remove-rule"
                type="button"
                onClick={() => onRemoveRule(rule.id)}
                aria-label={`Remove ${rule.term || "rule"}`}
              >
                <CloseIcon />
              </button>
            </div>
          ))}
        </div>

        <button className="add-rule" type="button" onClick={onAddRule}>
          <span aria-hidden="true">+</span>
          Add a quiet word
        </button>

        <div className="rule-options">
          <label className="field">
            <span>Replace with</span>
            <input
              value={text.replacement}
              placeholder="Leave empty to remove"
              onChange={(event) => onReplacementChange(event.target.value)}
            />
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={text.ignoreCase}
              onChange={(event) => onIgnoreCaseChange(event.target.checked)}
            />
            <span>Ignore case</span>
          </label>
        </div>

        <p className="rules-hint">
          Minimum 3 characters. Empty replacements also trim nearby punctuation.
        </p>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6" />
    </svg>
  );
}
