import Button from "./Button";
import { type CSSProperties, type ClassList, component$, useStyles$ } from "@qwik.dev/core";
import styles from "./Toolbar.uf.tsx.css?inline";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    useStyles$(styles);

    return (
      <div
        role="toolbar"
        aria-label="Actions"
        class={["toolbar", className]}
        data-uf-a33d603f=""
        {...scopeAttributes(attributes)}
        style={style}
      >
        <Button text="Save" data-uf-a33d603f="" />
        <Button text="Cancel" data-uf-a33d603f="" />
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
