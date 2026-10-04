// UF3023 non-nullable-operand: `??` after a required string prop, which is never null or
// undefined; the safe fix removes the operator and its fallback.
export interface HeadingProps {
  text: string;
}

export default function Heading({ text }: HeadingProps) {
  return <h2>{text ?? "Untitled"}</h2>;
}
