// L10 and what Chromium repainted before a capture. With partial raster, Chromium's default, a
// repaint re-rasterises only the repainted element's rect, rounded out to whole pixels, over the
// tile's old pixels. Where an element starts mid-pixel, that rect's edge cuts the anti-aliased
// corner of the box beside it, which rasterises one level apart from a whole raster: the same DOM
// then captured differently after a hover, a press or a keystroke repainted one control, and L10
// failed by a pixel at the edge of the control a test used last. The parity projects launch
// Chromium with whole-tile raster (`parityBrowser`), so a capture is a function of the DOM,
// whatever was repainted before it. Without `--disable-partial-raster`, this test fails.
import { expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../../../src/setup.ts";
import { describeTargets, mount } from "../../../../../src/index.ts";
import type { View } from "../../../../../src/index.ts";
import "../../../dom-target.ts";

const BOX = "display: block; height: 20px; border: 1px solid #767676; border-radius: 4px";

/**
 * Eight rows of two rounded boxes. Each row's left box ends at another eighth of a pixel, so the
 * right box starts mid-pixel, and its rect rounded out takes in the left box's corners. CSS boxes,
 * not native buttons: their rendering is the same on every platform.
 */
const ROWS = [0, 1, 2, 3, 4, 5, 6, 7]
  .map(
    (eighth) =>
      `<div style="display: flex; margin-bottom: 4px"><span style="${BOX}; width: ${20 + eighth / 8}px; background: #efefef"></span><span class="repainted" style="${BOX}; width: 30px; background: #efefef"></span></div>`,
  )
  .join("");

/** The container's pixels, as a PNG in base64. */
async function capture(view: View): Promise<string> {
  await view.settle();
  // Not saved, a screenshot is returned as base64.
  return page.screenshot({ element: view.container, save: false });
}

describeTargets("stub/raster", () => {
  it("captures the same DOM in the same pixels, whatever Chromium repainted last", async () => {
    const view = await mount({ html: ROWS });
    const fresh = await capture(view);
    const boxes = [...view.container.querySelectorAll<HTMLElement>(".repainted")];
    expect(boxes).toHaveLength(8);
    // Each right box alone, repainted and then restored, as a hover in and out repaints a button.
    for (const [index, box] of boxes.entries()) {
      box.style.background = "#e5e5e5";
      // The repaint is real and inside the capture: the pixels change while it lasts.
      if (index === 0) expect(await capture(view)).not.toBe(fresh);
      else await view.settle();
      box.style.background = "#efefef";
      await view.settle();
    }
    expect((await capture(view)) === fresh, "the capture after the repaints").toBe(true);
  });
});
