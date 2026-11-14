import Toast from "./Toast";
import { type CSSProperties, type ClassList, component$, useStyles$ } from "@qwik.dev/core";
import styles from "./Page.uf.tsx.css?inline";

export interface PageProps {
  message: string;
}

export default component$<PageProps & { class?: ClassList; style?: CSSProperties }>(
  ({ message, class: className, style, ...attributes }) => {
    useStyles$(styles);

    return (
      <section
        class={["page", className]}
        aria-label="Page"
        data-uf-5a3bed67=""
        {...scopeAttributes(attributes)}
        style={style}
      >
        <p data-uf-5a3bed67="">Saving…</p>
        <Toast message={message} data-uf-5a3bed67="" />
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
