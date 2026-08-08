import { describe, expect, it } from "vitest";

import type { TextFilterSettings } from "../shared/settings";
import { rewriteText } from "./text-filter";

const settings: TextFilterSettings = {
  enabled: true,
  ignoreCase: true,
  replacement: "",
  rules: [{ id: "breaking", term: "breaking", scope: "anywhere" }],
};

describe("rewriteText", () => {
  it("removes whole words and trailing punctuation", () => {
    expect(rewriteText("A BREAKING: update", settings)).toBe("A update");
  });

  it("does not remove matching fragments", () => {
    expect(rewriteText("A groundbreaking update", settings)).toBe("A groundbreaking update");
  });

  it("honors start-only rules", () => {
    const startOnly = {
      ...settings,
      rules: [{ id: "breaking", term: "breaking", scope: "start" as const }],
    };
    expect(rewriteText("Breaking — calm follows", startOnly)).toBe("calm follows");
    expect(rewriteText("Not breaking news", startOnly)).toBe("Not breaking news");
  });

  it("applies longer overlapping phrases first", () => {
    const overlapping = {
      ...settings,
      rules: [
        { id: "breaking", term: "breaking", scope: "anywhere" as const },
        { id: "breaking-news", term: "breaking news", scope: "anywhere" as const },
      ],
    };
    expect(rewriteText("Breaking news: an update", overlapping)).toBe("an update");
  });
});
