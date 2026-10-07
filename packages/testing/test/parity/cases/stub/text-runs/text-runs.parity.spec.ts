// L10 and the way a framework splits text into DOM nodes (ADR-0044's addendum). The evidence:
// Chromium lays out each text node's width in 1/64 px units and starts the next at the rounded
// edge, so the same text split over nodes is a fraction of a pixel wider and rasterises some
// glyphs differently, with or without the comments between. The rule: the capture merges every
// run of adjacent text nodes into one (src/browser/text-runs.ts), so a split captures exactly as
// one node does, while text, elements, styles and white space that render differently still
// differ, and the tree is restored, the same nodes, for what runs next.
import { expect, inject, it } from "vitest";
import { page } from "vitest/browser";

import "../../../../../src/setup.ts";
import { expectLayerFailure } from "../../../../../src/browser/behaviour.ts";
import { captureGeometry } from "../../../../../src/browser/geometry.ts";
import { mergeTextRuns, withMergedTextRuns } from "../../../../../src/browser/text-runs.ts";
import { describeTargets, mount } from "../../../../../src/index.ts";
import type { View } from "../../../../../src/index.ts";
import { LIVE_REFERENCE_SKIP } from "../../../../../src/visual-types.ts";
import "../../../dom-target.ts";

/** Texts as frameworks split them: one piece per text node. */
const SAMPLES: Record<string, string[]> = {
  price: ["Price: ", "12", " EUR"],
  kerning: ["A", "V", "A To Ta"],
  count: ["Showing ", "3", " of ", "10", " items"],
  digits: ["Total: ", "1,234.50", " (incl. VAT ", "20", "%)"],
  sentence: [
    "The quick brown fox jumps over the lazy dog, ",
    "and then ",
    "it rests in the shade of an old oak tree for the afternoon",
  ],
};

/** Whether the text wraps in a narrow paragraph, or lays out on one line. */
const WIDTHS = { line: "", narrow: "123px" } as const;

interface Shape {
  pieces: readonly string[];
  /** A comment between each two pieces, as framework anchors. */
  anchors?: boolean;
  width?: string;
  whiteSpace?: string;
}

/** Renders `<p>` with one text node per piece into the view's container. */
function render(view: View, { pieces, anchors = false, width = "", whiteSpace = "" }: Shape) {
  const p = document.createElement("p");
  p.style.width = width;
  p.style.whiteSpace = whiteSpace;
  pieces.forEach((piece, index) => {
    if (index && anchors) p.append(document.createComment(""));
    p.append(document.createTextNode(piece));
  });
  view.container.replaceChildren(p);
  return p;
}

/** Geometry and pixels, as L10 captures them: with the runs merged, or, for the evidence, not. */
async function capture(view: View, merged: boolean) {
  await view.settle();
  const shoot = async () => {
    const shot: unknown = await page.screenshot({
      element: view.container,
      base64: true,
      save: false,
    });
    return {
      geometry: captureGeometry(view.container),
      png: typeof shot === "string" ? shot : (shot as { base64: string }).base64,
    };
  };
  return merged ? withMergedTextRuns(view.container, shoot) : shoot();
}

/** The width of the paragraph's border box. */
const widthOf = (view: View) => view.container.firstElementChild!.getBoundingClientRect().width;

describeTargets("stub/text-runs", () => {
  it("evidence: the same text split over nodes is wider by 1/64 px a split, and some glyphs move", async () => {
    const view = await mount({ html: "" });
    render(view, { pieces: [SAMPLES.price!.join("")] });
    const single = await capture(view, false);
    const width = widthOf(view);
    render(view, { pieces: SAMPLES.price! });
    const split = await capture(view, false);
    expect(widthOf(view) - width).toBe(1 / 64);
    expect(split.png).not.toBe(single.png);
    // The comments between the nodes are not the cause: the split is.
    render(view, { pieces: SAMPLES.price!, anchors: true });
    expect((await capture(view, false)).png).toBe(split.png);
    // Not the line breaks either: in a narrow paragraph they are the same, and pixels still move.
    render(view, { pieces: [SAMPLES.sentence!.join("")], width: WIDTHS.narrow });
    const wrapped = await capture(view, false);
    render(view, { pieces: SAMPLES.sentence!, width: WIDTHS.narrow });
    const wrappedSplit = await capture(view, false);
    expect(widthOf(view)).toBe(123);
    expect(wrappedSplit.geometry.nodes["p[0]"]).toEqual(wrapped.geometry.nodes["p[0]"]);
    expect(wrappedSplit.png).not.toBe(wrapped.png);
  });

  it("captures text split over nodes, with or without anchors, as one node", async () => {
    const view = await mount({ html: "" });
    for (const [name, pieces] of Object.entries(SAMPLES)) {
      for (const width of Object.values(WIDTHS)) {
        render(view, { pieces: [pieces.join("")], width });
        const single = await capture(view, true);
        for (const anchors of [false, true]) {
          render(view, { pieces, anchors, width });
          const split = await capture(view, true);
          expect(split.geometry, `${name} ${width} ${anchors}`).toEqual(single.geometry);
          expect(split.png === single.png, `${name} ${width} ${anchors}: pixels`).toBe(true);
        }
      }
    }
  });

  it.each([
    ["different text", "<p>Price: 13 EUR</p>"],
    ["an element boundary", "<p>Price: <span>12</span> EUR</p>"],
    [
      "a different style on one part",
      '<p>Price: <span style="color: rgb(200, 0, 0)">12</span> EUR</p>',
    ],
    ["a different weight on one part", "<p>Price: <b>12</b> EUR</p>"],
  ])("still tells apart %s", async (_, html) => {
    const view = await mount({ html: "" });
    render(view, { pieces: SAMPLES.price! });
    const split = await capture(view, true);
    view.container.innerHTML = html;
    const other = await capture(view, true);
    expect(other.geometry).not.toEqual(split.geometry);
    expect(other.png).not.toBe(split.png);
  });

  it("still tells apart white space that renders differently, and only that", async () => {
    const view = await mount({ html: "" });
    const two = async (whiteSpace: string, a: readonly string[], b: readonly string[]) => {
      render(view, { pieces: a, whiteSpace });
      const first = await capture(view, true);
      render(view, { pieces: b, whiteSpace });
      return [first, await capture(view, true)] as const;
    };
    // Two spaces collapse into one outside `pre`, and stay two in it.
    const [collapsed, single] = await two("normal", ["a ", " b"], ["a b"]);
    expect(collapsed.png).toBe(single.png);
    const [kept, one] = await two("pre", ["a ", " b"], ["a b"]);
    expect(kept.png).not.toBe(one.png);
    expect(kept.geometry).not.toEqual(one.geometry);
  });

  it.each(["normal", "pre", "pre-wrap", "pre-line", "nowrap", "break-spaces"])(
    "lays out split white space as one node does, in white-space: %s",
    async (whiteSpace) => {
      const view = await mount({ html: "" });
      const cases = [
        ["one ", " two"],
        ["line\n", "\nline"],
        ["\t", "tab", "\t"],
        ["a", "   ", "b"],
        ["  lead", "trail  "],
      ];
      for (const pieces of cases) {
        // Unmerged: each character is where it is in one node, but for the 1/64 px a split
        // shifts what follows it, so merging hides nothing white-space processing does.
        render(view, { pieces: [pieces.join("")], whiteSpace, width: WIDTHS.narrow });
        const single = characterBoxes(view.container.firstElementChild!);
        render(view, { pieces, whiteSpace, width: WIDTHS.narrow });
        const split = characterBoxes(view.container.firstElementChild!);
        expect(split.length).toBe(single.length);
        const slack = pieces.length / 64 + 1e-9;
        split.forEach(([x, y, width, height], index) => {
          const [ex, ey, ewidth, eheight] = single[index]!;
          const where = `${JSON.stringify(pieces)} character ${index}`;
          expect(Math.abs(width - ewidth), where).toBeLessThanOrEqual(slack);
          // A collapsed character renders nothing, and a text node that collapses whole has no
          // box for a range to measure: only rendered characters have a place to compare.
          if (!width) return;
          expect(Math.abs(x - ex), where).toBeLessThanOrEqual(slack);
          expect([y, height], where).toEqual([ey, eheight]);
        });
        // Merged, the capture is the single node's.
        const merged = await capture(view, true);
        render(view, { pieces: [pieces.join("")], whiteSpace, width: WIDTHS.narrow });
        const reference = await capture(view, true);
        expect(merged.geometry, JSON.stringify(pieces)).toEqual(reference.geometry);
        expect(merged.png === reference.png, `${JSON.stringify(pieces)}: pixels`).toBe(true);
      }
    },
  );

  it("merges runs across comments, never across elements, and restores the same nodes", async () => {
    const view = await mount({ html: "" });
    view.container.innerHTML =
      "<p>a<!--x-->b<!--y--><b>c</b>d<!--z--></p><textarea>e</textarea><style>f{}</style>";
    const p = view.container.querySelector("p")!;
    p.append(document.createTextNode("e"));
    view.container.querySelector("textarea")!.append(document.createTextNode("!"));
    const before = [...view.container.querySelectorAll("*")].map((element) => [
      element,
      [...element.childNodes],
      [...element.childNodes].map((node) => node.nodeValue),
    ]);
    const restore = mergeTextRuns(view.container);
    // "a", "b" and the comment between them merge, and "d", "e" likewise; a comment after a
    // run's last text stays; "<b>" ends a run, and its own text is a run of its own.
    expect([...p.childNodes].map((node) => [node.nodeName, node.nodeValue])).toEqual([
      ["#text", "ab"],
      ["#comment", "y"],
      ["B", null],
      ["#text", "de"],
    ]);
    expect(view.container.querySelector("textarea")!.childNodes).toHaveLength(2);
    restore();
    const after = [...view.container.querySelectorAll("*")].map((element) => [
      element,
      [...element.childNodes],
      [...element.childNodes].map((node) => node.nodeValue),
    ]);
    expect(after).toHaveLength(before.length);
    after.forEach(([element, nodes, values], index) => {
      const [beforeElement, beforeNodes, beforeValues] = before[index]!;
      expect(element).toBe(beforeElement);
      expect((nodes as Node[]).every((node, at) => node === (beforeNodes as Node[])[at])).toBe(
        true,
      );
      expect(nodes).toHaveLength((beforeNodes as Node[]).length);
      expect(values).toEqual(beforeValues);
    });
  });

  it.skipIf(inject("ufHarness").update)(
    "merges inside expectParity's capture, then restores what a framework rerenders",
    async ({ task }) => {
      const view = await mount(
        {
          text: {
            tag: "p",
            anchors: true,
            pieces: ({ price = 12 }) => ["Price: ", String(price), " EUR"],
          },
        },
        { props: { price: 12 } },
      );
      const p = view.container.querySelector("p")!;
      const nodes = [...p.childNodes];
      const changes: MutationRecord[] = [];
      const observer = new MutationObserver((records) => changes.push(...records));
      observer.observe(view.container, { childList: true, subtree: true, characterData: true });
      await view.expectParity("split");
      changes.push(...observer.takeRecords());
      observer.disconnect();
      // No artefacts are committed for this scenario: L7 is not the subject.
      expectLayerFailure("L7", /Missing artefact/);
      expect(task.meta.uf?.layers.L10).toEqual({ status: "skip", reason: LIVE_REFERENCE_SKIP });
      // The capture took the split apart and put it back.
      expect(changes.filter((change) => change.removedNodes.length).length).toBeGreaterThan(0);
      expect(changes.filter((change) => change.addedNodes.length).length).toBeGreaterThan(0);
      expect([...p.childNodes].every((node, index) => node === nodes[index])).toBe(true);
      expect(p.childNodes).toHaveLength(nodes.length);
      // The stub writes into the nodes it created, as a framework does.
      await view.rerender({ price: 13 });
      await expect.element(view.getByText("Price: 13 EUR")).toBeVisible();
      // The rerender is a step of the view's trace, which has no committed artefact either.
      await view.expectParity("split-rerendered");
      expectLayerFailure(
        "L9",
        /Missing artefact cases\/stub\/text-runs\/__expected__\/trace\.split-rerendered\.json/,
      );
    },
  );
});

/** Each character's box in an element's text: x, y, width and height. */
function characterBoxes(element: Element): [number, number, number, number][] {
  const boxes: [number, number, number, number][] = [];
  for (const node of element.childNodes) {
    if (!(node instanceof Text)) continue;
    for (let index = 0; index < node.length; index += 1) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + 1);
      const { x, y, width, height } = range.getBoundingClientRect();
      boxes.push([x, y, width, height]);
    }
  }
  return boxes;
}
