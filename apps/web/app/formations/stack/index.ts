import { defineFormation, mergeViews, smoothstep } from "@uxfront/scene";
import type { AnchorDef, Formation, FormationOptions, Vec2 } from "@uxfront/scene";

import { NAME } from "./art";
import { CARDS, cardPoint, cardProgress, cardReach } from "./geometry";

/**
 * Each card's label is its framework's name, in the card's header: the
 * `UxAnchor` tag starts a little to the right of the anchor, so the anchor sits
 * just before the spot the artwork leaves for it.
 */
const LABEL: Vec2 = [NAME[0] - 0.07, NAME[1]];

/**
 * A stack of seven glass cards, one per compile target, each holding the
 * same component, a sign-up form, drawn in light and tinted in its framework's
 * colour. They're dealt one after another as the chapter is read: the first
 * lands in front, and each next one fans out from behind the one before it.
 * The form fills itself in on the same beat on all of them: the email is
 * typed, "remember me" switches on and submit is pressed. Follows the prism:
 * rail `i` flows into card `i`.
 *
 * Anchors `stack:0` to `stack:6` sit in the cards' headers, front to back,
 * where the name goes, and show once each card is in place.
 */
export function stack(options: FormationOptions): Formation {
  const anchors = Array.from({ length: CARDS }, (_, index): AnchorDef => ({
    id: String(index),
    place: ({ approach, local, time }, out) => {
      cardPoint(index, LABEL, time, out);
      return smoothstep(0.85, 1, cardReach(index, cardProgress(approach, local)));
    },
  }));
  return defineFormation({
    key: options.key ?? "stack",
    label: options.label,
    views: mergeViews(
      {
        desktop: {
          eye: [0, 2.7, 9.8],
          target: [0.99, 0.44, -1.5],
          fov: 30,
          span: [1.8, 1.55],
          shift: [0.34, 0],
        },
        mobile: {
          eye: [0, 2.5, 9.6],
          target: [0.84, 0.44, -1.5],
          fov: 34,
          span: [2.05, 2.1],
          shift: [0, 0.2],
        },
      },
      options.views,
    ),
    look: { bloom: 1, reflect: 0.5, ...options.look },
    anchors,
    shader: () => import("./shader").then((m) => m.shader),
  });
}
