import { type CSSProperties, type ClassList, component$, useStyles$ } from "@qwik.dev/core";
import "virtual:styleframe.css";
import styles from "./Panel.uf.tsx.css?inline";

export default component$<{ text: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ text, class: className, style, ...attributes }) => {
    useStyles$(styles);

    return (
      <section
        class={["panel", className]}
        data-uf-b6be1fd3=""
        {...scopeAttributes(attributes)}
        style={style}
      >
        <p class="body" data-uf-b6be1fd3="">
          {text}
        </p>
      </section>
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
