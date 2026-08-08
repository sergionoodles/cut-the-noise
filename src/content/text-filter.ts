import type { TextFilterSettings, TextRule } from "../shared/settings";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPattern(rule: TextRule, consumeTail: boolean): string {
  const escaped = escapeRegex(rule.term);
  const prefix = rule.scope === "start" ? "^\\s*" : "(?<![\\p{L}\\p{N}_])";
  const suffix = consumeTail ? "(?:[\\p{P}\\s]+)?" : "";
  return `${prefix}${escaped}(?![\\p{L}\\p{N}_])${suffix}`;
}

export function rewriteText(text: string, settings: TextFilterSettings): string {
  if (!settings.enabled || settings.rules.length === 0) return text;

  const flags = settings.ignoreCase ? "giu" : "gu";
  const consumeTail = settings.replacement === "";

  const rules = [...settings.rules].sort((left, right) => right.term.length - left.term.length);
  return rules.reduce((current, rule) => {
    if (rule.term.trim().length < 3) return current;
    return current.replace(
      new RegExp(buildPattern(rule, consumeTail), flags),
      settings.replacement,
    );
  }, text);
}
