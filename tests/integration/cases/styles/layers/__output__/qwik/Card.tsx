import { type CSSProperties, type ClassList, component$, useStyles$ } from "@qwik.dev/core";
import styles from "./Card.uf.tsx.css?inline";

export default component$<{ title: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ title, class: className, style, ...attributes }) => {
    useStyles$(styles);

    return (
      <section
        class={["card", className]}
        data-uf-bb60e985=""
        {...scopeAttributes(attributes)}
        style={style}
      >
        <h2 class="title" data-uf-bb60e985="">
          {title}
        </h2>
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
