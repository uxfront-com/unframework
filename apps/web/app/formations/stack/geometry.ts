import { lerp, smoothstep } from "@uxfront/scene";
import type { Vec2, Vec3 } from "@uxfront/scene";

/** One card per compile target, front to back in the prism's rail order: Angular in front. */
export const CARDS = 7;

/** Half size of a card's artwork, in art units (see `art.ts`). */
export const CARD: Vec2 = [0.64, 0.52];

/** World units per art unit. */
export const CARD_SCALE = 1.4;

/** Centre of the front card, the first one dealt. */
export const FRONT: Vec3 = [0, -0.4, 0];

/**
 * From one card to the card behind it: up and to the right at about 45°, and
 * away, so each card peeks out above and beside the one in front of it.
 */
export const BEHIND: Vec3 = [0.33, 0.28, -0.5];

/** Cards are dealt one after another as the chapter is read, like the prism's rails. */
export const cardReach = (index: number, progress: number): number =>
  smoothstep(index * 0.08, index * 0.08 + 0.45, progress);

/** Share of the dealing that happens while the chapter scrolls in. */
export const CARD_APPROACH = 0.35;

/** Deal progress: starts with the morph into the formation, not once it's held. */
export const cardProgress = (approach: number, local: number): number =>
  approach < 1 ? approach * CARD_APPROACH : lerp(CARD_APPROACH, 1, local);

/** The stack floats. The engine clock only runs with motion on. */
export const stackBob = (time: number): number => Math.sin(time * 0.7) * 0.03;

/** Where the point `q` (card-local, in art units) of a card at rest is in the world. */
export function cardPoint(index: number, q: Vec2, time: number, out: Vec3): Vec3 {
  const depth = index;
  out[0] = FRONT[0] + depth * BEHIND[0] + q[0] * CARD_SCALE;
  out[1] = FRONT[1] + depth * BEHIND[1] + q[1] * CARD_SCALE + stackBob(time);
  out[2] = FRONT[2] + depth * BEHIND[2];
  return out;
}
