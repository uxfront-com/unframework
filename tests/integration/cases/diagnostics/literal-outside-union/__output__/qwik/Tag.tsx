import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export type Tone = "info" | "warning";

export default component$<{ tone: Tone } & { class?: ClassList; style?: CSSProperties }>(
  ({ tone, class: className, style, ...attributes }) => {
    return (
      <span class={["tag", tone, className]} {...scopeAttributes(attributes)} style={style}>
        {tone}
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
