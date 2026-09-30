import { lerp, smoothstep } from "@uxfront/scene";
import type { Vec2, Vec3 } from "@uxfront/scene";

/** One beam per compile target, top to bottom in the prism's rail order. */
export const BEAMS = 7;

/** The film: a disc of light standing in the dark, its centre and radius. */
export const CENTER: Vec3 = [0, 0.15, 0];
export const RADIUS = 1.35;

const deg = (d: number) => (d * Math.PI) / 180;
const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};

/**
 * The film stands turned about the vertical: its normal points right and away,
 * so its right-hand side comes towards the viewer.
 */
const TURN = deg(40);
export const NORMAL: Vec3 = [Math.cos(TURN), 0, -Math.sin(TURN)];
/** In the film's plane: across (horizontal, towards the viewer) and up. */
export const ACROSS: Vec3 = [Math.sin(TURN), 0, Math.cos(TURN)];
export const UP: Vec3 = [0, 1, 0];

/**
 * The beams come in from the left, parallel, and go through the film. Beyond
 * it they're `FASTER` times faster: they turn the corner and converge, over
 * `CONVERGE` world units, into one white stream that races off into the
 * distance, the prism in reverse.
 */
export const IN_DIR: Vec3 = [1, 0, 0];
export const OUT_DIR: Vec3 = unit([0.28, 0, -1]);
export const CONVERGE = 2.6;
export const FASTER = 2.2;

/**
 * Where the beams cross the film: down its vertical diameter, like the prism's
 * rails. The height of the first above the centre, and the step to the next.
 */
export const CROSSING: Vec2 = [0.84, 0.28];

/** How far each beam runs before the film, and after it. */
export const IN_LENGTH = 5;
export const OUT_LENGTH = 11;

/**
 * Beams break through one after another as the chapter is read: beam `i` from
 * `from + i * step`, over `span` of the progress.
 */
export const BREAK = { from: 0.22, step: 0.05, span: 0.25 };

/** Share of the progress that happens while the chapter scrolls in. */
export const BEAM_APPROACH = 0.3;

/** Progress: starts with the morph into the formation, not once it's held. */
export const beamProgress = (approach: number, local: number): number =>
  approach < 1 ? approach * BEAM_APPROACH : lerp(BEAM_APPROACH, 1, local);

/** How far beam `index` has broken through the film, 0 → 1 (see `BREAK`). */
export const beamReach = (index: number, progress: number): number => {
  const from = BREAK.from + index * BREAK.step;
  return smoothstep(from, from + BREAK.span, progress);
};

/** Where the seven meet, level with the middle beam: past the film, round the corner. */
export const MERGE: Vec3 = [
  CENTER[0] + IN_DIR[0] * 0.9 + OUT_DIR[0] * 1.5,
  CENTER[1] + CROSSING[0] - 3 * CROSSING[1],
  CENTER[2] + IN_DIR[2] * 0.9 + OUT_DIR[2] * 1.5,
];

/** A point `t` world units down the white stream, past where the seven meet. */
export function streamPoint(t: number, out: Vec3): Vec3 {
  out[0] = MERGE[0] + OUT_DIR[0] * t;
  out[1] = MERGE[1] + OUT_DIR[1] * t;
  out[2] = MERGE[2] + OUT_DIR[2] * t;
  return out;
}
