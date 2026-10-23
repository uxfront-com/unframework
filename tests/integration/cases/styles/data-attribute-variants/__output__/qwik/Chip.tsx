import { type CSSProperties, type ClassList, component$, useStyles$ } from "@qwik.dev/core";
import styles from "./Chip.uf.tsx.css?inline";

export default component$<
  { label: string; variant?: "neutral" | "danger"; pressed?: boolean } & {
    class?: ClassList;
    style?: CSSProperties;
  }
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
      {...scopeAttributes(attributes)}
      style={style}
    >
      {label}
    </button>
  );
});

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
