// What stock tsgo catches in a component's own props (ADR-0034): the signature is ordinary
// TypeScript, so a default must fit its member's type.

export interface SizeProps {
  size?: "sm" | "md";
  count?: number;
}

// @ts-expect-error TS2322 the default 42 is not "sm" | "md"
export function WrongDefault({ size = 42 }: SizeProps) {
  return <p>{size}</p>;
}

// @ts-expect-error TS2322 the default "many" is not a number
export function WrongNumberDefault({ count = "many" }: SizeProps) {
  return <p>{count}</p>;
}
