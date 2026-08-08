/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";

import { parseProductRating, parseRatingText } from "./amazon";

describe("parseRatingText", () => {
  it("parses common English alt text", () => {
    expect(parseRatingText("4.2 out of 5 stars")).toBe(4.2);
    expect(parseRatingText("4,5 out of 5 stars")).toBe(4.5);
  });

  it("rejects invalid values", () => {
    expect(parseRatingText("no rating")).toBeNull();
    expect(parseRatingText("9 out of 5 stars")).toBeNull();
  });
});

describe("parseProductRating", () => {
  it("reads .a-icon-alt inside a result", () => {
    const result = document.createElement("div");
    result.innerHTML = '<span class="a-icon-alt">3.8 out of 5 stars</span>';
    expect(parseProductRating(result)).toBe(3.8);
  });

  it("falls back to aria-label", () => {
    const result = document.createElement("div");
    result.innerHTML = '<span aria-label="4.0 out of 5 stars">stars</span>';
    expect(parseProductRating(result)).toBe(4);
  });

  it("parses star CSS class names", () => {
    const result = document.createElement("div");
    result.innerHTML = '<i class="a-icon a-icon-star-small a-star-small-3-5"></i>';
    expect(parseProductRating(result)).toBe(3.5);
  });
});
