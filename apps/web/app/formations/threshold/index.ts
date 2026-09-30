import { defineFormation, mergeViews, smoothstep } from "@uxfront/scene";
import type { Formation, FormationOptions } from "@uxfront/scene";

import { BEAMS, CONVERGE, OUT_LENGTH, beamProgress, beamReach, streamPoint } from "./geometry";

/** The white stream's label: how far down the stream, and how far above it. */
const LABEL_AT = 0.3;
const LABEL_ABOVE = 0.32;

/**
 * The seven beams of light, one per compile target, cross a film of light into
 * whatever comes next. The film is a soap film on a ring: its colours swirl as
 * it drains, and ripples spread from where each beam goes through. Beyond it
 * the light is faster: the beams turn the corner and converge into one white
 * stream, the prism in reverse, which races off into the distance, its pulses
 * stretched into streaks. They break through one after another as the chapter
 * is read, and the stream brightens as each one joins it.
 *
 * Anchor `threshold:stream` sits just above the white stream, for its label,
 * and shows once every beam has joined it.
 */
export function threshold(options: FormationOptions): Formation {
  return defineFormation({
    key: options.key ?? "threshold",
    label: options.label,
    views: mergeViews(
      {
        desktop: {
          eye: [1.5, 0.6, 10.5],
          target: [0.9, 0.1, -0.6],
          fov: 30,
          span: [2.9, 1.8],
          shift: [-0.3, 0],
        },
        mobile: {
          eye: [1.5, 0.6, 10.5],
          target: [0.75, 0.1, -0.6],
          fov: 34,
          span: [1.8, 1.5],
          shift: [0, 0.3],
        },
      },
      options.views,
    ),
    look: { bloom: 1.15, reflect: 0.6, ...options.look },
    anchors: [
      {
        id: "stream",
        place: ({ approach, local }, out) => {
          streamPoint(LABEL_AT, out);
          out[1] += LABEL_ABOVE;
          const joined = (CONVERGE + LABEL_AT) / OUT_LENGTH;
          const reach = beamReach(BEAMS - 1, beamProgress(approach, local));
          return smoothstep(joined, Math.min(1, joined + 0.25), reach);
        },
      },
    ],
    shader: () => import("./shader").then((m) => m.shader),
  });
}
