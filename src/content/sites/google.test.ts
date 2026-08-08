/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";

import {
  blockAncestor,
  collectSponsoredBlocks,
  isSponsoredLabel,
} from "./google";

describe("isSponsoredLabel", () => {
  it("recognizes common English labels", () => {
    expect(isSponsoredLabel("Sponsored")).toBe(true);
    expect(isSponsoredLabel("  AD  ")).toBe(true);
    expect(isSponsoredLabel("Ads")).toBe(true);
  });

  it("recognizes common locales", () => {
    expect(isSponsoredLabel("Anzeige")).toBe(true);
    expect(isSponsoredLabel("Anuncio")).toBe(true);
    expect(isSponsoredLabel("Sponsorisé")).toBe(true);
  });

  it("rejects ordinary text", () => {
    expect(isSponsoredLabel("Results")).toBe(false);
    expect(isSponsoredLabel("Sponsored by a friend")).toBe(false);
  });
});

describe("blockAncestor", () => {
  it("stops before major result column containers", () => {
    document.body.innerHTML = `
      <div id="center_col">
        <div class="ad-card">
          <div class="inner">
            <span id="label">Sponsored</span>
          </div>
        </div>
      </div>
    `;
    const label = document.getElementById("label")!;
    const block = blockAncestor(label);
    expect(block.className).toBe("ad-card");
    expect(block.id).not.toBe("center_col");
  });
});

describe("collectSponsoredBlocks", () => {
  it("finds top and bottom ad containers by id", () => {
    document.body.innerHTML = `
      <div id="center_col">
        <div id="tads"><div>Top ad</div></div>
        <div id="rso"><div>Organic</div></div>
        <div id="tadsb"><div>Bottom ad</div></div>
      </div>
    `;
    const blocks = collectSponsoredBlocks(document.body);
    const ids = blocks.map((el) => el.id).sort();
    expect(ids).toEqual(["tads", "tadsb"]);
  });

  it("finds data-text-ad and commercial units", () => {
    document.body.innerHTML = `
      <div data-text-ad="1">Text ad</div>
      <div class="commercial-unit-desktop-top">Shopping</div>
      <div class="pla-unit">PLA</div>
    `;
    const blocks = collectSponsoredBlocks(document.body);
    expect(blocks).toHaveLength(3);
  });

  it("tags inline sponsored cards via label text", () => {
    document.body.innerHTML = `
      <div id="rso">
        <div class="card">
          <span>Sponsored</span>
          <a href="https://example.com">Buy now</a>
        </div>
        <div class="organic">
          <span>About this result</span>
        </div>
      </div>
    `;
    const blocks = collectSponsoredBlocks(document.body);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].className).toBe("card");
  });

  it("does not double-count labels already inside #tads", () => {
    document.body.innerHTML = `
      <div id="tads">
        <span>Sponsored</span>
        <div>Ad body</div>
      </div>
    `;
    const blocks = collectSponsoredBlocks(document.body);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe("tads");
  });
});
