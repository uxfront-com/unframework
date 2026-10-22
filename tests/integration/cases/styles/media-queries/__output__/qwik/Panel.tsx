import { type CSSProperties, type ClassList, component$, useStyles$ } from "@qwik.dev/core";
import styles from "./Panel.uf.tsx.css?inline";

export default component$<{ text: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ text, class: className, style, ...attributes }) => {
    useStyles$(styles);

    return (
      <aside
        class={["panel", className]}
        data-uf-48dda3f4=""
        {...scopeAttributes(attributes)}
        style={style}
      >
        <p class="text" data-uf-48dda3f4="">
          {text}
        </p>
      </aside>
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
