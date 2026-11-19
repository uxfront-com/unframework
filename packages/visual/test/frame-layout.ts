// What a preview frame's mount container lays out (ADR-0114), read in the frame: its computed flex
// properties, and where its content sits against the frame's centre.
import type { FrameLocator, Page } from "playwright";

/** The container's computed layout, and its content's offset from the frame's centre, in pixels. */
export interface FrameLayout {
  display: string;
  flexDirection: string;
  justifyContent: string;
  alignItems: string;
  flexWrap: string;
  gap: string;
  paddingTop: string;
  /** The container's height against the frame's, so a block layout is seen to fill it. */
  height: number;
  innerHeight: number;
  /** The centre of the container's content less the frame's centre, on each axis. */
  dx: number;
  dy: number;
}

/** Reads a frame's layout: one in the shell, or a standalone frame page (ADR-0112). */
export function frameLayout(frame: FrameLocator | Page): Promise<FrameLayout> {
  return frame.locator("[data-uf-preview-root]").evaluate((container) => {
    const style = getComputedStyle(container);
    // The boxes of the container's flex items: an element with `display: contents`, as Angular's
    // host, makes none of its own, so its children stand in for it. A range over the container
    // would skip them, since it counts only the outermost elements it holds.
    const boxes = (node: Node): DOMRect[] =>
      [...node.childNodes].flatMap((child): DOMRect[] => {
        if (child instanceof Element) {
          const display = getComputedStyle(child).display;
          if (display === "contents") return boxes(child);
          return display === "none" ? [] : [child.getBoundingClientRect()];
        }
        if (child.nodeType !== Node.TEXT_NODE || !child.textContent?.trim()) return [];
        const range = document.createRange();
        range.selectNodeContents(child);
        return [range.getBoundingClientRect()];
      });
    const items = boxes(container);
    const content = {
      left: Math.min(...items.map((box) => box.left)),
      top: Math.min(...items.map((box) => box.top)),
      right: Math.max(...items.map((box) => box.right)),
      bottom: Math.max(...items.map((box) => box.bottom)),
    };
    return {
      display: style.display,
      flexDirection: style.flexDirection,
      justifyContent: style.justifyContent,
      alignItems: style.alignItems,
      flexWrap: style.flexWrap,
      gap: style.rowGap === style.columnGap ? style.rowGap : style.gap,
      paddingTop: style.paddingTop,
      height: container.getBoundingClientRect().height,
      innerHeight: window.innerHeight,
      dx: (content.left + content.right) / 2 - window.innerWidth / 2,
      dy: (content.top + content.bottom) / 2 - window.innerHeight / 2,
    };
  });
}

/** The computed layout of an example with no `@layout`: centred on both axes, in a row. */
export const CENTRED = {
  display: "flex",
  flexDirection: "row",
  justifyContent: "safe center",
  alignItems: "safe center",
  flexWrap: "nowrap",
} as const;

/** Whether a frame's content sits at its centre, to within a pixel on each axis. */
export function centred(layout: FrameLayout): boolean {
  return Math.abs(layout.dx) <= 1 && Math.abs(layout.dy) <= 1;
}
