// The types the components share. A plain module: the build copies it into every target's tree.
export type ButtonVariant = "primary" | "secondary";

export interface CounterProps {
  initial?: number;
  step?: number;
}
