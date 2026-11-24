import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

// The Qwik output of `<component is={x ? "input" : "a"} form="f1" list="l1" aria-label="Field" />`
// (ADR-0119): Qwik's types declare neither `form` nor `list` on <input>, so each is an object
// spread, its value guarded on the tag that renders.
export default component$<{ x: boolean } & { class?: ClassList; style?: CSSProperties }>(
  ({ x, class: className, style, ...attributes }) => {
    const Tag = x ? "input" : "a";

    return (
      <>
        <Tag
          {...{ form: Tag === "input" ? "f1" : undefined }}
          {...{ list: Tag === "input" ? "l1" : undefined }}
          aria-label="Field"
          {...scopeAttributes(attributes)}
          class={className}
          style={style}
        />
      </>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) {
      scope[key] = "";
    }
  }
  return scope;
}
