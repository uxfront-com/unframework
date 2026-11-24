import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useStyles$,
} from "@qwik.dev/core";
import styles from "./Chip.uf.tsx.css?inline";

export default component$<
  { label: string; variant?: "neutral" | "danger"; pressed?: boolean } & Omit<
    PropsOf<"button">,
    "label" | "variant" | "pressed" | "class" | "style"
  > & { class?: ClassList; style?: CSSProperties }
>(({ label, variant = "neutral", pressed = false, class: className, style, ...attributes }) => {
  useStyles$(styles);

  return (
    <button
      type="button"
      class={["chip", className]}
      data-variant={variant}
      data-state={pressed ? "on" : "off"}
      aria-pressed={pressed ? "true" : "false"}
      data-uf-69db3802=""
      style={style}
      {...attributes}
    >
      {label}
    </button>
  );
});
