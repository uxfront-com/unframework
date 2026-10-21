import { type JSX, mergeProps } from "solid-js";

export default function Chip(
  rawProps: { label: string; variant?: "neutral" | "danger"; pressed?: boolean } & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const props = mergeProps(
    { variant: "neutral", pressed: false } satisfies Partial<{
      label: string;
      variant?: "neutral" | "danger";
      pressed?: boolean;
    }>,
    rawProps,
  );
  return (
    <button
      type="button"
      class={props.class ? `chip ${props.class}` : "chip"}
      data-variant={props.variant}
      data-state={props.pressed ? "on" : "off"}
      aria-pressed={props.pressed ? "true" : "false"}
      data-uf-69db3802=""
      style={props.style}
    >
      {props.label}
    </button>
  );
}
