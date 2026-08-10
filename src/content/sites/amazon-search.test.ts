/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";

import { createDefaultSettings } from "../../shared/settings";
import {
  amazonAdapter,
  getAmazonSearchWords,
  isHighRatingSection,
  isSponsoredSection,
  productTitleMatchesSearch,
} from "./amazon";

describe("getAmazonSearchWords", () => {
  it("extracts normalized words from Amazon keyword-search URLs", () => {
    expect(getAmazonSearchWords("https://www.amazon.com/s?k=USB-C+Cable")).toEqual([
      "usb",
      "c",
      "cable",
    ]);
    expect(getAmazonSearchWords("https://www.amazon.it/s/ref=nb_sb_noss?k=caff%C3%A8")).toEqual([
      "caffè",
    ]);
  });

  it("ignores non-search pages and searches without a string", () => {
    expect(getAmazonSearchWords("https://www.amazon.com/dp/B012345678?k=cable")).toEqual([]);
    expect(getAmazonSearchWords("https://www.amazon.com/s?i=electronics")).toEqual([]);
    expect(getAmazonSearchWords("https://www.amazon.com/s?k=+++")).toEqual([]);
    expect(getAmazonSearchWords("not a url")).toEqual([]);
  });
});

describe("productTitleMatchesSearch", () => {
  function resultWithTitle(title: string): Element {
    const result = document.createElement("div");
    result.innerHTML = `<h2><a><span>${title}</span></a></h2>`;
    return result;
  }

  it("matches when any searched word occurs in the product title", () => {
    const result = resultWithTitle("Braided USB Charging Lead");
    expect(productTitleMatchesSearch(result, ["usb", "cable"])).toBe(true);
  });

  it("does not match substrings or text outside the product title", () => {
    const result = resultWithTitle("Wireless Mouse");
    result.insertAdjacentHTML("beforeend", "<span>Sponsored cable offer</span>");

    expect(productTitleMatchesSearch(result, ["wire"])).toBe(false);
    expect(productTitleMatchesSearch(result, ["cable"])).toBe(false);
  });

  it("keeps results unchanged when there are no search words", () => {
    expect(productTitleMatchesSearch(resultWithTitle("Anything"), [])).toBe(true);
  });

  it("keeps an incomplete result visible until its title is available", () => {
    expect(productTitleMatchesSearch(document.createElement("div"), ["cable"])).toBe(true);
  });
});

describe("Amazon search sections", () => {
  it("detects full-width sponsored modules", () => {
    const adHolder = document.createElement("div");
    adHolder.className = "s-result-item AdHolder s-flex-full-width";
    expect(isSponsoredSection(adHolder)).toBe(true);

    const labeled = document.createElement("div");
    labeled.innerHTML = "<div><span>Sponsorizzato</span></div>";
    expect(isSponsoredSection(labeled)).toBe(true);
  });

  it("does not mistake ordinary sections for sponsored modules", () => {
    const section = document.createElement("div");
    section.innerHTML = "<h2>More results</h2>";
    expect(isSponsoredSection(section)).toBe(false);

    section.innerHTML = `
      <div data-cy="title-recipe"><h2>Organic recommendation</h2></div>
      <div data-cy="title-recipe"><h2>Paid recommendation</h2></div>
      <div class="product"><span>Sponsored</span></div>
    `;
    expect(isSponsoredSection(section)).toBe(false);
  });

  it("detects the high-rating featured-ASIN carousel", () => {
    const section = document.createElement("div");
    section.innerHTML = '<h2 id="loom-desktop-inline-slot_featuredasins-heading">4 stars and above</h2>';
    expect(isHighRatingSection(section)).toBe(true);

    section.innerHTML = '<h2 id="loom-desktop-inline-slot_featuredasins-heading">  4 stars\n and above </h2>';
    expect(isHighRatingSection(section)).toBe(true);
  });

  it("does not mistake other featured-ASIN carousels for high-rating sections", () => {
    const section = document.createElement("div");
    section.innerHTML = '<h2 id="loom-desktop-bottom-slot_featuredasins-heading">Explore Amazon Influencer picks</h2>';
    expect(isHighRatingSection(section)).toBe(false);
  });

  it("applies and composes modes on full-width result sections", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="s-main-slot">
        <div class="s-result-item AdHolder" data-testid="ad"></div>
        <div class="s-result-item" data-component-type="" data-testid="rated">
          <h2 id="loom-desktop-inline-slot_featuredasins-heading">4 stars and above</h2>
        </div>
        <div class="s-result-item" data-testid="ordinary"><h2>More results</h2></div>
      </div>
    `;
    const settings = createDefaultSettings();
    settings.sites.amazon.filters.sponsored = "hide";
    settings.sites.amazon.filters.highRatingSections = "mute";

    amazonAdapter.applyFilters(root, settings);

    expect(root.querySelector('[data-testid="ad"]')?.getAttribute("data-ctn-amazon")).toBe("hide");
    expect(root.querySelector('[data-testid="rated"]')?.getAttribute("data-ctn-amazon")).toBe("mute");
    expect(root.querySelector('[data-testid="ordinary"]')?.hasAttribute("data-ctn-amazon")).toBe(false);

    root.querySelector('[data-testid="rated"]')?.insertAdjacentHTML(
      "beforeend",
      "<span>Sponsored</span>",
    );
    amazonAdapter.applyFilters(root, settings);
    expect(root.querySelector('[data-testid="rated"]')?.getAttribute("data-ctn-amazon")).toBe("hide");
  });
});
