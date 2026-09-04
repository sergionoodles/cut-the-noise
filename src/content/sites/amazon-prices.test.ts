/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";

import {
  applyPriceRounding,
  resetPriceRounding,
  roundPriceText,
  shouldRoundPricesForUrl,
} from "./amazon-prices";

describe("roundPriceText", () => {
  it("rounds .90-.99 up to the next integer", () => {
    expect(roundPriceText("$49.99")).toBe("$50");
    expect(roundPriceText("$49.98")).toBe("$50");
    expect(roundPriceText("$49.95")).toBe("$50");
    expect(roundPriceText("$49.90")).toBe("$50");
    expect(roundPriceText("$99.90")).toBe("$100");
    expect(roundPriceText("99,90€")).toBe("100€");
    expect(roundPriceText("$1,899.99")).toBe("$1,900");
    expect(roundPriceText("1.899,99€")).toBe("1.900€");
    expect(roundPriceText("49,99 €")).toBe("50 €");
  });

  it("rounds .49/.48 up to .50 below 100", () => {
    expect(roundPriceText("$49.49")).toBe("$49.50");
    expect(roundPriceText("$49.48")).toBe("$49.50");
    expect(roundPriceText("89,49€")).toBe("89,50€");
    expect(roundPriceText("89,48€")).toBe("89,50€");
  });

  it("rounds prices from 100 up to the next hundred", () => {
    expect(roundPriceText("$149.99")).toBe("$200");
    expect(roundPriceText("$149.49")).toBe("$200");
    expect(roundPriceText("$149.95")).toBe("$200");
    expect(roundPriceText("$1,899.99")).toBe("$1,900");
    expect(roundPriceText("$1,899.49")).toBe("$1,900");
    expect(roundPriceText("1.899,99€")).toBe("1.900€");
    expect(roundPriceText("2.345,67€")).toBe("2.400€");
    expect(roundPriceText("149,99€")).toBe("200€");
    expect(roundPriceText("$150.00")).toBe("$200");
  });

  it("leaves exact hundreds alone", () => {
    expect(roundPriceText("$200.00")).toBe("$200.00");
    expect(roundPriceText("$1,900.00")).toBe("$1,900.00");
    expect(roundPriceText("1.900,00€")).toBe("1.900,00€");
  });

  it("handles thousands rollover", () => {
    expect(roundPriceText("$999.99")).toBe("$1,000");
    expect(roundPriceText("999,99€")).toBe("1.000€");
  });

  it("leaves non-charm prices and bare numbers alone", () => {
    expect(roundPriceText("$49.85")).toBe("$49.85");
    expect(roundPriceText("$49.00")).toBe("$49.00");
    expect(roundPriceText("49.99")).toBe("49.99");
    expect(roundPriceText("4.9 out of 5 stars")).toBe("4.9 out of 5 stars");
    expect(roundPriceText("89,85€")).toBe("89,85€");
  });

  it("rounds every price in a longer string", () => {
    expect(roundPriceText("was $19.99 now $49.99")).toBe("was $20 now $50");
  });
});

describe("shouldRoundPricesForUrl", () => {
  it("allows search and product pages", () => {
    expect(shouldRoundPricesForUrl("https://www.amazon.com/s?k=cable")).toBe(true);
    expect(shouldRoundPricesForUrl("https://www.amazon.de/dp/B012345678")).toBe(true);
    expect(shouldRoundPricesForUrl("https://www.amazon.com/gp/product/B012345678")).toBe(true);
  });

  it("excludes cart, checkout and order pages", () => {
    expect(shouldRoundPricesForUrl("https://www.amazon.com/gp/cart/view.html")).toBe(false);
    expect(shouldRoundPricesForUrl("https://www.amazon.com/gp/checkout/display.html")).toBe(false);
    expect(shouldRoundPricesForUrl("https://www.amazon.com/gp/buy/spc/handlers/display.html")).toBe(false);
    expect(shouldRoundPricesForUrl("https://www.amazon.com/gp/css/order-history")).toBe(false);
    expect(shouldRoundPricesForUrl("https://www.amazon.com/gp/your-account/order-history")).toBe(false);
    expect(shouldRoundPricesForUrl("not a url")).toBe(false);
  });
});

describe("applyPriceRounding", () => {
  it("rounds split .a-price markup and restores it", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <span class="a-price">
        <span class="a-offscreen">$49.99</span>
        <span aria-hidden="true"><span class="a-price-symbol">$</span><span class="a-price-whole">49</span><span class="a-price-fraction">99</span></span>
      </span>
    `;
    const container = root.querySelector(".a-price") as Element;

    applyPriceRounding(root);
    expect(root.querySelector(".a-offscreen")?.textContent).toBe("$50");
    expect(root.querySelector('[aria-hidden="true"]')?.textContent).toBe("$50");
    expect(container.hasAttribute("data-ctn-price-rounded")).toBe(true);

    // Re-applying must stay stable (no double rounding).
    applyPriceRounding(root);
    expect(root.querySelector(".a-offscreen")?.textContent).toBe("$50");

    resetPriceRounding(root);
    expect(root.querySelector(".a-offscreen")?.textContent).toBe("$49.99");
    expect(container.hasAttribute("data-ctn-price-rounded")).toBe(false);
  });

  it("rounds .49 to .50 inside split markup", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <span class="a-price">
        <span class="a-offscreen">$49.49</span>
        <span aria-hidden="true">$49.49</span>
      </span>
    `;

    applyPriceRounding(root);
    expect(root.querySelector(".a-offscreen")?.textContent).toBe("$49.50");
    expect(root.querySelector('[aria-hidden="true"]')?.textContent).toBe("$49.50");

    resetPriceRounding(root);
    expect(root.querySelector(".a-offscreen")?.textContent).toBe("$49.49");
  });

  it("rounds big prices to hundreds inside split markup", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <span class="a-price">
        <span class="a-offscreen">$149.99</span>
        <span aria-hidden="true">$149.99</span>
      </span>
    `;

    applyPriceRounding(root);
    expect(root.querySelector(".a-offscreen")?.textContent).toBe("$200");

    resetPriceRounding(root);
    expect(root.querySelector(".a-offscreen")?.textContent).toBe("$149.99");
  });

  it("rounds split markup with a blank .a-offscreen from the visible price", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <span class="a-price aok-align-center reinventPricePriceToPayMargin priceToPay apex-pricetopay-value" data-a-size="xl" data-a-color="base"><span class="a-offscreen"> </span><span aria-hidden="true"><span class="a-price-whole">99<span class="a-price-decimal">,</span></span><span class="a-price-fraction">90</span><span class="a-price-symbol">€</span></span></span>
    `;
    const container = root.querySelector(".a-price") as Element;

    applyPriceRounding(root);
    expect(root.querySelector(".a-offscreen")?.textContent).toBe("100€");
    expect(root.querySelector('[aria-hidden="true"]')?.textContent).toBe("100€");
    expect(container.hasAttribute("data-ctn-price-rounded")).toBe(true);

    resetPriceRounding(root);
    expect(root.querySelector(".a-offscreen")?.textContent).toBe(" ");
    expect(root.querySelector(".a-price-fraction")?.textContent).toBe("90");
    expect(container.hasAttribute("data-ctn-price-rounded")).toBe(false);
  });

  it("rounds plain Euro price text and restores it", () => {
    const root = document.createElement("div");
    root.innerHTML = "<span>1.899,99€</span>";
    const text = root.querySelector("span")?.firstChild as Text;

    applyPriceRounding(root);
    expect(text.textContent).toBe("1.900€");

    resetPriceRounding(root);
    expect(text.textContent).toBe("1.899,99€");
  });
});
