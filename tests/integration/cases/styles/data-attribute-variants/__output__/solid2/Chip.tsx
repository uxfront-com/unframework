import type { ComponentProps, JSX } from "@solidjs/web";
import { merge, omit } from "solid-js";
import "./Chip.uf.tsx.css";

export default function Chip(
  rawProps: { label: string; variant?: "neutral" | "danger"; pressed?: boolean } & Omit<
    ComponentProps<"button">,
    "label" | "variant" | "pressed" | "class" | "style"
  > & { class?: string; style?: JSX.CSSProperties },
) {
  const props = merge(rawProps, {
    get variant() {
      return rawProps.variant === undefined ? "neutral" : rawProps.variant;
    },
    get pressed() {
      return rawProps.pressed === undefined ? false : rawProps.pressed;
    },
  });
  const others = omit(props, "label", "variant", "pressed", "class");

  return (
    <button
      type="button"
      class={props.class ? `chip ${props.class}` : "chip"}
      data-variant={props.variant}
      data-state={props.pressed ? "on" : "off"}
      aria-pressed={props.pressed ? "true" : "false"}
      data-uf-69db3802=""
      {...others}
    >
      {props.label}
    </button>
  );
}
