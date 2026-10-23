import { type CSSProperties, type ClassList, component$, useStyles$ } from "@qwik.dev/core";
import styles from "./Badge.uf.tsx.css?inline";

export default component$<
  { label: string; count: number } & { class?: ClassList; style?: CSSProperties }
>(({ label, count, class: className, style, ...attributes }) => {
  useStyles$(styles);

  return (
    <span
      class={["badge", className]}
      data-uf-d9cef2e7=""
      {...scopeAttributes(attributes)}
      style={style}
    >
      <span class="label" data-uf-d9cef2e7="">
        {label}
      </span>
      <span class="count" data-uf-d9cef2e7="">
        {count}
      </span>
    </span>
  );
});

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
