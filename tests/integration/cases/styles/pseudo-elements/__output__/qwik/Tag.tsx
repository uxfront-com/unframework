import { type CSSProperties, type ClassList, component$, useStyles$ } from "@qwik.dev/core";
import styles from "./Tag.uf.tsx.css?inline";

export default component$<{ name: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ name, class: className, style, ...attributes }) => {
    useStyles$(styles);

    return (
      <span
        class={["tag", className]}
        data-uf-ef5e671c=""
        {...scopeAttributes(attributes)}
        style={style}
      >
        {name}
      </span>
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
