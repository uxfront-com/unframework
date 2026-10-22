import { type CSSProperties, type ClassList, component$, useStyles$ } from "@qwik.dev/core";
import styles from "./Progress.uf.tsx.css?inline";

export default component$<{ label: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ label, class: className, style, ...attributes }) => {
    useStyles$(styles);

    return (
      <div
        class={["progress", className]}
        data-uf-0738d8af=""
        {...scopeAttributes(attributes)}
        style={style}
      >
        <span class="dot" data-uf-0738d8af="" />
        <span data-uf-0738d8af="">{label}</span>
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
