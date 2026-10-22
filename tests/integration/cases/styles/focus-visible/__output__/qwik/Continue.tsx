import { type CSSProperties, type ClassList, component$, useStyles$ } from "@qwik.dev/core";
import styles from "./Continue.uf.tsx.css?inline";

export default component$<{ text: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ text, class: className, style, ...attributes }) => {
    useStyles$(styles);

    return (
      <button
        type="button"
        class={["continue", className]}
        data-uf-bb3adc28=""
        {...scopeAttributes(attributes)}
        style={style}
      >
        {text}
      </button>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
