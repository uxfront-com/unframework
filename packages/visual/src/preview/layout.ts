// How an entry's layout becomes CSS on the frame's mount container (ADR-0114). Browser-safe: the
// frame imports it, and it imports only types and constants. It is not part of the `./frame`
// subpath's API, which exports only what `frame.ts` declares.
import { DEFAULT_LAYOUT } from "./protocol.ts";
import type { PreviewLayout } from "./protocol.ts";

type FlexLayout = Extract<PreviewLayout, { display: "flex" }>;

/**
 * `safe` keeps an example larger than its frame at the start edge, where scrolling reaches it: a
 * plain `center` would push half of it out of reach above and to the left.
 */
const JUSTIFY: Readonly<Record<FlexLayout["justify"], string>> = {
  start: "flex-start",
  center: "safe center",
  end: "safe flex-end",
  between: "space-between",
  around: "space-around",
  evenly: "space-evenly",
};

const ALIGN: Readonly<Record<FlexLayout["align"], string>> = {
  start: "flex-start",
  center: "safe center",
  end: "safe flex-end",
  stretch: "stretch",
  baseline: "baseline",
};

/**
 * The declarations a layout puts on the container, by CSS property name, or those of
 * {@link DEFAULT_LAYOUT} for none. A flex layout fills the frame with `1rem` of padding, and
 * `none` is a block that fills it with none.
 */
export function layoutStyle(layout: PreviewLayout = DEFAULT_LAYOUT): Record<string, string> {
  if (layout.display === "block") {
    return { display: "block", "box-sizing": "border-box", "min-height": "100%", padding: "0" };
  }
  return {
    display: "flex",
    "box-sizing": "border-box",
    "min-height": "100%",
    padding: "1rem",
    "flex-direction": layout.direction,
    "justify-content": JUSTIFY[layout.justify],
    "align-items": ALIGN[layout.align],
    "flex-wrap": layout.wrap ? "wrap" : "nowrap",
    gap: layout.gap,
  };
}
