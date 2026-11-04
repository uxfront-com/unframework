// Design tokens shared by every component of a design system (ADR-0070): plain values, which
// each output tree holds a copy of.
export const SIZES = { sm: "Small", md: "Medium", lg: "Large" } as const;

export type Size = keyof typeof SIZES;

export const DEFAULT_SIZE: Size = "md";

export const SIZE_ORDER: readonly Size[] = Object.freeze(["sm", "md", "lg"]);
