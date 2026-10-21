// Geometry and computed-style snapshot of everything under a capture container (L10). It is
// compared before pixels, because a delta here explains a pixel difference, and it is the same
// on every platform once Chromium runs with --font-render-hinting=none (the screenshot ADR).
//
// Keys are stable element paths relative to the container: `tag[i]` among same-tag element
// siblings and `#text[i]` for non-blank text nodes. The capture merges each run of adjacent text
// nodes into one first (./text-runs.ts), so a target's text-node split never shifts the keys.
// `display: contents` elements (Angular hosts under D6) are transparent: their children are keyed
// as children of the parent, so wrapper differences between targets do not shift paths. An
// element's `::before` and `::after` are keyed `<path>::before` and `<path>::after` where they
// generate content (ADR-0061): the DOM gives them no box, so they hold computed styles only.
import type { GeometrySnapshot, GeometryBox, GeometryNode } from "../visual-types.ts";

/** The computed properties that explain how a box looks. Width and height come from the box. */
export const GEOMETRY_STYLE_PROPERTIES: readonly string[] = [
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "float",
  "box-sizing",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-top-style",
  "border-right-style",
  "border-bottom-style",
  "border-left-style",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
  "color",
  "background-color",
  "background-image",
  "opacity",
  "visibility",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "text-align",
  "text-decoration-line",
  "text-transform",
  "text-shadow",
  "white-space",
  "vertical-align",
  "overflow-x",
  "overflow-y",
  "z-index",
  "transform",
  "box-shadow",
  "outline-style",
  "outline-width",
  "outline-color",
  "outline-offset",
  "list-style-type",
  "flex-direction",
  "flex-wrap",
  "justify-content",
  "align-items",
  "row-gap",
  "column-gap",
  "grid-template-columns",
  "grid-template-rows",
];

/** The pseudo-elements captured where their computed `content` is not `none`. */
const PSEUDO_ELEMENTS = ["::before", "::after"] as const;

/** The captured properties of a computed style. */
function styleOf(computed: CSSStyleDeclaration): Record<string, string> {
  const style: Record<string, string> = {};
  for (const property of GEOMETRY_STYLE_PROPERTIES) {
    style[property] = computed.getPropertyValue(property);
  }
  return style;
}

const toBox = (rect: DOMRect, origin: DOMRect): GeometryBox => [
  rect.x - origin.x,
  rect.y - origin.y,
  rect.width,
  rect.height,
];

/** Snapshots the boxes and computed styles of every element and text node under a container. */
export function captureGeometry(container: Element): GeometrySnapshot {
  const origin = container.getBoundingClientRect();
  const nodes: Record<string, GeometryNode> = {};

  const visit = (parent: Node, prefix: string) => {
    const counters = new Map<string, number>();
    const next = (key: string) => {
      const index = counters.get(key) ?? 0;
      counters.set(key, index + 1);
      return `${prefix}${key}[${index}]`;
    };
    for (const child of flatten(parent)) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (!child.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(child);
        nodes[next("#text")] = { box: [...range.getClientRects()].map((r) => toBox(r, origin)) };
      } else if (child instanceof Element) {
        const path = next(child.localName);
        nodes[path] = {
          box: toBox(child.getBoundingClientRect(), origin),
          style: styleOf(getComputedStyle(child)),
        };
        for (const pseudo of PSEUDO_ELEMENTS) {
          const computed = getComputedStyle(child, pseudo);
          if (computed.content === "none") continue;
          nodes[`${path}${pseudo}`] = {
            style: { ...styleOf(computed), content: computed.content },
          };
        }
        // A `<textarea>`'s text is its default value, which it shows as its value, never laid out:
        // the box holds what it shows, and L7 compares the value (`uf:value`, ADR-0058's 4d).
        if (child.localName !== "textarea") visit(child, `${path}/`);
      }
    }
  };
  visit(container, "");
  return { version: 1, nodes };
}

/** The element and text children of a node, looking through `display: contents` wrappers. */
function flatten(parent: Node): Node[] {
  const out: Node[] = [];
  for (const child of parent.childNodes) {
    if (child instanceof Element && getComputedStyle(child).display === "contents") {
      out.push(...flatten(child));
    } else if (child.nodeType === Node.TEXT_NODE || child instanceof Element) {
      out.push(child);
    }
  }
  return out;
}
