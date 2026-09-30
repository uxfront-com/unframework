import type { Vec2 } from "@uxfront/scene";

import { CARD } from "./geometry";

/**
 * What a shape does while the formation plays. The form fills itself in on
 * the same beat on every card, because every card holds the same component:
 * the email is typed (`typing`, with its `caret`), the toggle switches on
 * (`track`, `knob`) and the submit button is pressed (`button`).
 */
export const ROLE = { still: 0, knob: 1, track: 2, button: 3, typing: 4, caret: 5 } as const;
type Role = (typeof ROLE)[keyof typeof ROLE];

/**
 * Card artwork, in card-local coordinates (`CARD` half extents): x to the
 * right, y up. `bright` scales the line's light.
 */
export type CardShape =
  | { kind: "seg"; a: Vec2; b: Vec2; bright: number; role?: Role }
  | { kind: "rrect"; c: Vec2; h: Vec2; r: number; bright: number; role?: Role }
  | { kind: "circle"; c: Vec2; r: number; bright: number; role?: Role }
  | { kind: "disc"; c: Vec2; r: number; bright: number; role?: Role }
  | { kind: "fill"; c: Vec2; h: Vec2; r: number; bright: number; role?: Role };

/** How far the toggle's knob travels when it switches on. */
export const KNOB_TRAVEL = 0.08;

/** The email being typed: where the text starts, and how long it gets. */
export const TYPED_FROM: Vec2 = [-0.53, -0.1];
export const TYPED_LENGTH = 0.46;

/**
 * Where the framework's name goes, in the header: the page pins its label
 * there (see the formation's anchors), so the artwork leaves the spot empty.
 */
export const NAME: Vec2 = [-0.46, 0.44];

const FIELD_H = 0.052;
const ACTIONS_Y = -0.36;
const TOGGLE: Vec2 = [-0.5, ACTIONS_Y];
const CANCEL: Vec2 = [0.2, ACTIONS_Y];
const SUBMIT: Vec2 = [0.47, ACTIONS_Y];
const BUTTON_H: Vec2 = [0.12, 0.058];

/** A labelled text field: the label above, the input and its placeholder. */
const field = (x: number, y: number, halfWidth: number, placeholder: number): CardShape[] => [
  {
    kind: "seg",
    a: [x - halfWidth + 0.01, y + 0.1],
    b: [x - halfWidth + 0.15, y + 0.1],
    bright: 0.55,
  },
  { kind: "rrect", c: [x, y], h: [halfWidth, FIELD_H], r: 0.03, bright: 0.7 },
  ...(placeholder > 0
    ? [
        {
          kind: "seg",
          a: [x - halfWidth + 0.05, y],
          b: [x - halfWidth + 0.05 + placeholder, y],
          bright: 0.25,
        } satisfies CardShape,
      ]
    : []),
];

/**
 * One component, the same on every card: a sign-up form, with a header (the
 * part that shows above the card in front), first and last name, an email,
 * a "remember me" toggle, and cancel and submit buttons.
 */
export const COMPONENT_ART: CardShape[] = [
  // The card.
  { kind: "rrect", c: [0, 0], h: CARD, r: 0.06, bright: 0.75 },
  // Header: icon, title (the label), subtitle and status.
  { kind: "circle", c: [-0.55, 0.415], r: 0.045, bright: 1 },
  { kind: "disc", c: [-0.55, 0.415], r: 0.016, bright: 0.9 },
  { kind: "seg", a: [NAME[0], 0.385], b: [-0.12, 0.385], bright: 0.45 },
  { kind: "disc", c: [0.56, 0.415], r: 0.02, bright: 1.2 },
  { kind: "seg", a: [-0.6, 0.3], b: [0.6, 0.3], bright: 0.25 },
  // First and last name, side by side.
  ...field(-0.29, 0.12, 0.27, 0.16),
  ...field(0.29, 0.12, 0.27, 0.12),
  // Email, typed in.
  ...field(0, -0.1, 0.58, 0),
  {
    kind: "seg",
    a: TYPED_FROM,
    b: [TYPED_FROM[0] + TYPED_LENGTH, TYPED_FROM[1]],
    bright: 0.9,
    role: ROLE.typing,
  },
  {
    kind: "seg",
    a: [TYPED_FROM[0] + 0.012, TYPED_FROM[1] - 0.03],
    b: [TYPED_FROM[0] + 0.012, TYPED_FROM[1] + 0.03],
    bright: 1.2,
    role: ROLE.caret,
  },
  // Remember me.
  { kind: "fill", c: TOGGLE, h: [0.085, 0.045], r: 0.045, bright: 0.3, role: ROLE.track },
  { kind: "rrect", c: TOGGLE, h: [0.085, 0.045], r: 0.045, bright: 0.8, role: ROLE.track },
  {
    kind: "disc",
    c: [TOGGLE[0] - KNOB_TRAVEL / 2, TOGGLE[1]],
    r: 0.03,
    bright: 1.3,
    role: ROLE.knob,
  },
  { kind: "seg", a: [-0.38, ACTIONS_Y], b: [-0.14, ACTIONS_Y], bright: 0.55 },
  // Cancel, then the primary button: submit.
  { kind: "rrect", c: CANCEL, h: BUTTON_H, r: BUTTON_H[1], bright: 0.6 },
  { kind: "seg", a: [CANCEL[0] - 0.05, ACTIONS_Y], b: [CANCEL[0] + 0.05, ACTIONS_Y], bright: 0.5 },
  { kind: "fill", c: SUBMIT, h: BUTTON_H, r: BUTTON_H[1], bright: 0.35, role: ROLE.button },
  { kind: "rrect", c: SUBMIT, h: BUTTON_H, r: BUTTON_H[1], bright: 1.1, role: ROLE.button },
  {
    kind: "seg",
    a: [SUBMIT[0] - 0.05, ACTIONS_Y],
    b: [SUBMIT[0] + 0.05, ACTIONS_Y],
    bright: 1,
    role: ROLE.button,
  },
];

const shapeWeight = (shape: CardShape): number => {
  if (shape.kind === "seg") return Math.hypot(shape.b[0] - shape.a[0], shape.b[1] - shape.a[1]);
  if (shape.kind === "rrect") {
    const r = Math.min(shape.r, shape.h[0], shape.h[1]);
    return 4 * (shape.h[0] + shape.h[1]) - 8 * r + 2 * Math.PI * r;
  }
  if (shape.kind === "circle") return 2 * Math.PI * shape.r;
  // Filled shapes need more particles to read as solid.
  if (shape.kind === "disc") return Math.PI * shape.r * shape.r * 24;
  return 4 * shape.h[0] * shape.h[1] * 24;
};

const TYPE = { seg: 0, rrect: 1, circle: 2, disc: 3, fill: 4 } as const;

export interface ShapeTable {
  /** Geometry: `seg` a.xy, b.xy; `rrect` and `fill` centre, half size; `circle` and `disc` centre, radius. */
  a: number[][];
  /** Type, corner radius, role, brightness. */
  b: number[][];
  /** Cumulative share of the particles, by line length (or area, for fills). */
  cdf: number[];
  totalWeight: number;
}

/**
 * Packs the artwork into constant arrays for the shader. Particles pick a
 * shape by the CDF, so every line gets the same particle density.
 */
export function buildShapeTable(shapes: readonly CardShape[]): ShapeTable {
  const weights = shapes.map(shapeWeight);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let running = 0;
  const cdf = weights.map((w) => (running += w) / totalWeight);
  // Guard against float drift so the last shape always catches x → 1.
  cdf[cdf.length - 1] = 1.0001;
  const a = shapes.map((shape) => {
    if (shape.kind === "seg") return [...shape.a, ...shape.b];
    if (shape.kind === "rrect" || shape.kind === "fill") return [...shape.c, ...shape.h];
    return [...shape.c, shape.r, 0];
  });
  const b = shapes.map((shape) => [
    TYPE[shape.kind],
    shape.kind === "rrect" || shape.kind === "fill" ? shape.r : 0,
    shape.role ?? ROLE.still,
    shape.bright,
  ]);
  return { a, b, cdf, totalWeight };
}
