// Every type the module exports is exported by each output (ADR-0068): one the props reach, and
// one no component reaches.
export type ButtonTone = "primary" | "secondary";

export type ButtonSize = "small" | "large";

export interface ButtonProps {
  label: string;
  tone?: ButtonTone;
}

export default function Button({ label, tone = "primary" }: ButtonProps) {
  return (
    <button type="button" class={`button button-${tone}`}>
      {label}
    </button>
  );
}
