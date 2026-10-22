import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export const Pill = component$<{ text: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ text, class: className, style, ...attributes }) => {
    return (
      <span class={["pill", className]} {...scopeAttributes_1(attributes)} style={style}>
        {text}
      </span>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes_1(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
