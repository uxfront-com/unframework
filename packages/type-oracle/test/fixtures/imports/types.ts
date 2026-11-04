export type Size = "sm" | "md" | "lg";

export interface Base {
  id: string;
  disabled?: boolean;
}

export interface Labelled extends Base {
  label: string;
  readonly size?: Size;
}

// Not exported: importing it is unresolved, though a type here uses it.
interface Hidden {
  secret: string;
}

export type Secret = { hidden: Hidden };

export type Tone = "neutral" | "danger";
