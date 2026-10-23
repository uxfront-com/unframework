import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export const Hint = component$<{ text: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ text, class: className, style, ...attributes }) => {
    return (
      <small class={["hint", className]} {...scopeAttributes(attributes)} style={style}>
        {text}
      </small>
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
