import Row from "./Row";
import { type CSSProperties, type ClassList, component$, useStyles$ } from "@qwik.dev/core";
import styles from "./List.uf.tsx.css?inline";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    useStyles$(styles);

    return (
      <div
        class={["list", className]}
        data-uf-ced7d23e=""
        {...scopeAttributes(attributes)}
        style={style}
      >
        <Row text="One" data-uf-ced7d23e="" />
        <Row text="Two" data-uf-ced7d23e="" />
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
