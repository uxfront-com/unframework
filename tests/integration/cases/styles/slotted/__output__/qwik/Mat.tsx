import { type CSSProperties, type ClassList, Slot, component$, useStyles$ } from "@qwik.dev/core";
import styles from "./Mat.uf.tsx.css?inline";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    useStyles$(styles);

    return (
      <div
        class={["mat", className]}
        data-uf-09929c4a=""
        {...scopeAttributes(attributes)}
        style={style}
      >
        <Slot />
      </div>
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
