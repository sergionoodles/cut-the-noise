import { describe, expect, it } from "vitest";

import { sites } from "./catalog";

describe("amazon catalog grouping", () => {
  it("keeps the price toggle out of Filters in its own section", () => {
    expect(sites.amazon.filters.some((filter) => filter.key === "roundPrices")).toBe(false);
    expect(sites.amazon.extraSections).toHaveLength(1);
    expect(sites.amazon.extraSections[0]?.title).toBe("Price rounding");
    expect(sites.amazon.extraSections[0]?.controls.map((control) => control.key)).toEqual([
      "roundPrices",
    ]);
  });

  it("leaves other sites without extra sections", () => {
    expect(sites.x.extraSections).toEqual([]);
    expect(sites.google.extraSections).toEqual([]);
  });
});
