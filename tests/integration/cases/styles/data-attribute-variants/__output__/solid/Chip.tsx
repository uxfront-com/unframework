import { type JSX, mergeProps } from "solid-js";
import "./Chip.uf.tsx.css";

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
      {...scopeAttributes(props)}
    >
      {props.label}
    </button>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
